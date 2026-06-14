import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../common/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { TypedConfigService } from '../config/config.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { RoutesService } from '../routes/routes.service';
import { AgentGatewayService } from '../agent-gateway/agent-gateway.service';
import { generateKeyPair, generatePresharedKey, renderClientConfig } from '../common/wireguard.util';
import { nextFreeIp } from '../common/ip-alloc.util';
import { PeerStatus, ServerStatus } from '@aximavpn/shared';

@Injectable()
export class PeersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: TypedConfigService,
    private readonly subscriptions: SubscriptionsService,
    private readonly routes: RoutesService,
    private readonly agent: AgentGatewayService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.wireguardPeer.findMany({
      where: { userId, status: PeerStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
      include: { server: { select: { name: true, country: { select: { code: true, flagEmoji: true } } } } },
    });
  }

  /**
   * Create a peer for a user on a chosen server. Enforces active subscription,
   * device limit, country allow-list and server capacity. Generates keys,
   * allocates an IP, pushes the peer to the agent, and stores it (keys encrypted).
   */
  async create(userId: string, serverId: string, label?: string) {
    const subscription = await this.subscriptions.getActive(userId);
    if (!subscription) throw new ForbiddenException('No active subscription');

    const activePeers = await this.prisma.wireguardPeer.count({
      where: { userId, status: PeerStatus.ACTIVE },
    });
    if (activePeers >= subscription.tariff.deviceLimit) {
      throw new ForbiddenException(`Device limit reached (${subscription.tariff.deviceLimit})`);
    }

    const server = await this.prisma.vpnServer.findUnique({ where: { id: serverId } });
    if (!server || server.status !== ServerStatus.ACTIVE) throw new NotFoundException('Server not available');
    if (!server.serverPublicKey) throw new BadRequestException('Server not registered yet');

    // Country allow-list from the tariff (empty = all countries allowed).
    const allowed = subscription.tariff.allowedCountries;
    if (allowed.length > 0 && !allowed.some((c) => c.id === server.countryId)) {
      throw new ForbiddenException('Country not included in your tariff');
    }

    // Capacity + IP allocation.
    const existingActive = await this.prisma.wireguardPeer.findMany({
      where: { serverId, status: PeerStatus.ACTIVE },
      select: { assignedIp: true },
    });
    if (existingActive.length >= server.maxPeers) throw new ForbiddenException('Server is at capacity');

    const subnet = this.config.get('WG_SUBNET_CIDR');
    const serverAddress = this.config.get('WG_SERVER_ADDRESS');
    const assignedIp = nextFreeIp(subnet, serverAddress, existingActive.map((p) => p.assignedIp));

    const keys = generateKeyPair();
    const presharedKey = generatePresharedKey();
    const { versionId, cidrs } = await this.routes.getCurrentAllowedIps();
    const allowedIpsSnapshot = cidrs.length > 0 ? cidrs.join(',') : '0.0.0.0/0';

    // Push to the agent first; if it fails, no DB row is created (consistency).
    await this.agent.addPeer(
      { agentUrl: server.agentUrl, agentTokenEnc: server.agentTokenEnc },
      { publicKey: keys.publicKey, presharedKey, allowedIps: [`${assignedIp}/32`] },
    );

    const peer = await this.prisma.wireguardPeer.create({
      data: {
        userId,
        serverId,
        label,
        publicKey: keys.publicKey,
        privateKeyEnc: this.crypto.encrypt(keys.privateKey),
        presharedKeyEnc: this.crypto.encrypt(presharedKey),
        assignedIp,
        status: PeerStatus.ACTIVE,
        routeListVersionId: versionId,
        needsUpdate: false,
      },
    });

    return { id: peer.id, assignedIp, allowedIps: allowedIpsSnapshot };
  }

  /** Rebuild the .conf for a peer owned by the user (keys decrypted on the fly). */
  async getConfig(userId: string, peerId: string): Promise<string> {
    const peer = await this.loadOwned(userId, peerId);
    const server = await this.prisma.vpnServer.findUnique({ where: { id: peer.serverId } });
    if (!server?.serverPublicKey) throw new BadRequestException('Server public key missing');

    const { cidrs } = await this.routes.getCurrentAllowedIps();
    return renderClientConfig({
      clientPrivateKey: this.crypto.decrypt(peer.privateKeyEnc),
      clientAddress: `${peer.assignedIp}/32`,
      dns: this.config.get('WG_DNS'),
      serverPublicKey: server.serverPublicKey,
      presharedKey: this.crypto.decrypt(peer.presharedKeyEnc),
      endpoint: `${server.ip}:${server.wgEndpointPort}`,
      allowedIps: cidrs,
    });
  }

  async getQrDataUrl(userId: string, peerId: string): Promise<string> {
    const conf = await this.getConfig(userId, peerId);
    return QRCode.toDataURL(conf, { errorCorrectionLevel: 'M', margin: 1, width: 400 });
  }

  /** Revoke a peer: remove from the agent and mark revoked (kept for audit/history). */
  async revoke(userId: string, peerId: string) {
    const peer = await this.loadOwned(userId, peerId);
    const server = await this.prisma.vpnServer.findUnique({ where: { id: peer.serverId } });
    if (server) {
      await this.agent
        .removePeer({ agentUrl: server.agentUrl, agentTokenEnc: server.agentTokenEnc }, peer.publicKey)
        .catch(() => undefined); // tolerate agent being down; DB stays source of truth
    }
    await this.prisma.wireguardPeer.update({ where: { id: peer.id }, data: { status: PeerStatus.REVOKED } });
    return { revoked: true };
  }

  /** Recreate: revoke the old peer and create a fresh one on the same server. */
  async recreate(userId: string, peerId: string) {
    const peer = await this.loadOwned(userId, peerId);
    await this.revoke(userId, peerId);
    return this.create(userId, peer.serverId, peer.label ?? undefined);
  }

  /** Admin: delete a user's peer entirely. */
  async adminDelete(peerId: string) {
    const peer = await this.prisma.wireguardPeer.findUnique({ where: { id: peerId } });
    if (!peer) throw new NotFoundException('Peer not found');
    const server = await this.prisma.vpnServer.findUnique({ where: { id: peer.serverId } });
    if (server && peer.status === PeerStatus.ACTIVE) {
      await this.agent
        .removePeer({ agentUrl: server.agentUrl, agentTokenEnc: server.agentTokenEnc }, peer.publicKey)
        .catch(() => undefined);
    }
    await this.prisma.wireguardPeer.delete({ where: { id: peerId } });
    return { deleted: true };
  }

  private async loadOwned(userId: string, peerId: string) {
    const peer = await this.prisma.wireguardPeer.findUnique({ where: { id: peerId } });
    if (!peer || peer.userId !== userId) throw new NotFoundException('Peer not found');
    if (peer.status !== PeerStatus.ACTIVE) throw new BadRequestException('Peer is revoked');
    return peer;
  }
}

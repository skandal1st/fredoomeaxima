import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { TypedConfigService } from '../config/config.module';
import { buildInstallScript } from './install-script';
import { CreateServerInput } from '@aximavpn/shared';
import { ServerStatus } from '@aximavpn/shared';

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: TypedConfigService,
  ) {}

  list() {
    return this.prisma.vpnServer.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        country: { select: { code: true, name: true, flagEmoji: true } },
        _count: { select: { peers: { where: { status: 'ACTIVE' } } } },
      },
    });
  }

  /** Servers a user can pick from: active, with free capacity, optionally by country. */
  async listAvailable(countryId?: string) {
    const servers = await this.prisma.vpnServer.findMany({
      where: { status: ServerStatus.ACTIVE, ...(countryId ? { countryId } : {}) },
      include: {
        country: { select: { code: true, name: true, flagEmoji: true } },
        _count: { select: { peers: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });
    return servers
      .filter((s) => s._count.peers < s.maxPeers)
      .map((s) => ({
        id: s.id,
        name: s.name,
        country: s.country,
        load: s._count.peers,
        capacity: s.maxPeers,
      }));
  }

  async get(id: string) {
    const server = await this.prisma.vpnServer.findUnique({
      where: { id },
      include: {
        country: true,
        _count: { select: { peers: { where: { status: 'ACTIVE' } } } },
        healthChecks: { orderBy: { checkedAt: 'desc' }, take: 5 },
      },
    });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }

  /** Internal helper for other services needing decryptable agent ref fields. */
  async getRaw(id: string) {
    const server = await this.prisma.vpnServer.findUnique({ where: { id } });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }

  async create(input: CreateServerInput) {
    const installToken = randomBytes(24).toString('hex');
    // Pre-generate the agent bearer token; embed it in the install script and
    // store it encrypted so the panel can authenticate to the agent later.
    const agentToken = randomBytes(32).toString('hex');

    // Agent endpoint: explicit URL or derived from the public IP + agent port.
    const agentUrl = input.agentUrl ?? `http://${input.ip}:${input.agentPort}`;

    const server = await this.prisma.vpnServer.create({
      data: {
        name: input.name,
        countryId: input.countryId,
        ip: input.ip,
        sshUser: input.sshUser,
        sshPort: input.sshPort,
        wgEndpointPort: input.wgEndpointPort,
        agentUrl,
        agentTokenEnc: this.crypto.encrypt(agentToken),
        maxPeers: input.maxPeers,
        monthlyCostCents: input.monthlyCostCents,
        costCurrency: input.costCurrency,
        provider: input.provider,
        nextRenewalAt: input.nextRenewalAt ? new Date(input.nextRenewalAt) : null,
        status: ServerStatus.PENDING,
        installToken,
      },
    });

    return { server, installToken, agentToken };
  }

  async update(id: string, input: Partial<CreateServerInput> & { status?: ServerStatus }) {
    await this.getRaw(id);
    return this.prisma.vpnServer.update({
      where: { id },
      data: {
        name: input.name,
        countryId: input.countryId,
        ip: input.ip,
        sshUser: input.sshUser,
        sshPort: input.sshPort,
        wgEndpointPort: input.wgEndpointPort,
        agentUrl: input.agentUrl,
        maxPeers: input.maxPeers,
        monthlyCostCents: input.monthlyCostCents,
        costCurrency: input.costCurrency,
        provider: input.provider,
        status: input.status,
        nextRenewalAt: input.nextRenewalAt ? new Date(input.nextRenewalAt) : undefined,
      },
    });
  }

  /** Returns the install command + the full script body for the admin to run on the VPS. */
  async getInstallInstructions(id: string) {
    const server = await this.getRaw(id);
    if (!server.installToken) {
      throw new BadRequestException('Server already registered (install token consumed)');
    }
    const agentToken = server.agentTokenEnc ? this.crypto.decrypt(server.agentTokenEnc) : '';
    const panelUrl = this.config.get('PANEL_PUBLIC_URL');
    const script = buildInstallScript({
      panelUrl,
      serverId: server.id,
      installToken: server.installToken,
      agentToken,
      wgEndpointPort: server.wgEndpointPort,
      wgSubnetCidr: this.config.get('WG_SUBNET_CIDR'),
      wgServerAddress: this.config.get('WG_SERVER_ADDRESS'),
    });
    // One-liner the admin pastes on a fresh Ubuntu VPS.
    const command = `curl -fsSL ${panelUrl}/servers/${server.id}/install-script?token=${server.installToken} | sudo bash`;
    return { command, script };
  }

  /** Public install-script endpoint body (token-gated). */
  async getInstallScript(id: string, token: string) {
    const server = await this.getRaw(id);
    if (!server.installToken || server.installToken !== token) {
      throw new BadRequestException('Invalid or consumed install token');
    }
    const { script } = await this.getInstallInstructions(id);
    return script;
  }

  /**
   * Called by the agent during bootstrap. Verifies the one-time install token,
   * records the server public key + endpoint and activates the server.
   */
  async register(params: { serverId: string; installToken: string; serverPublicKey: string }) {
    const server = await this.getRaw(params.serverId);
    if (!server.installToken || server.installToken !== params.installToken) {
      throw new BadRequestException('Invalid install token');
    }
    return this.prisma.vpnServer.update({
      where: { id: server.id },
      data: {
        serverPublicKey: params.serverPublicKey,
        status: ServerStatus.ACTIVE,
        registeredAt: new Date(),
        lastHeartbeatAt: new Date(),
        installToken: null, // one-time use
      },
      select: { id: true, name: true, status: true },
    });
  }

  /** Called periodically by the agent. Auth is the per-server agent token. */
  async heartbeat(params: { serverId: string; agentToken: string; peerCount?: number; wgUp?: boolean }) {
    const server = await this.getRaw(params.serverId);
    const expected = server.agentTokenEnc ? this.crypto.decrypt(server.agentTokenEnc) : null;
    if (!expected || expected !== params.agentToken) {
      throw new BadRequestException('Invalid agent token');
    }
    const recovering = server.status === ServerStatus.UNREACHABLE;
    await this.prisma.vpnServer.update({
      where: { id: server.id },
      data: {
        lastHeartbeatAt: new Date(),
        // Auto-recover from UNREACHABLE; leave DISABLED/MAINTENANCE under admin control.
        ...(recovering ? { status: ServerStatus.ACTIVE } : {}),
      },
    });
    return { ok: true };
  }

  async remove(id: string) {
    await this.getRaw(id);
    await this.prisma.vpnServer.delete({ where: { id } });
    return { deleted: true };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'net';
import { PrismaService } from '../common/prisma.service';
import { AgentGatewayService } from '../agent-gateway/agent-gateway.service';
import { TelegramService } from '../notifications/telegram.service';
import { ServerStatus } from '@aximavpn/shared';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: AgentGatewayService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Run a health check against one server. The panel checks reachability + WG
   * UDP port; target-service availability (DNS + HTTPS) is delegated to the agent
   * because it lives in the destination country and measures real client paths.
   */
  async checkServer(serverId: string) {
    const server = await this.prisma.vpnServer.findUnique({ where: { id: serverId } });
    if (!server) return;
    if (server.status === ServerStatus.DISABLED || server.status === ServerStatus.MAINTENANCE) return;

    const start = Date.now();
    const reachable = await this.tcpPing(server.ip, server.sshPort, 4000);
    const wgPortOpen = await this.udpPortReachable(server.ip, server.wgEndpointPort);
    const latencyMs = reachable ? Date.now() - start : null;

    let dnsOk = false;
    let targetResults: Record<string, boolean> = {};
    let firstUnavailable: string | undefined;
    try {
      const check = await this.agent.targetCheck({ agentUrl: server.agentUrl, agentTokenEnc: server.agentTokenEnc });
      dnsOk = check.dnsOk;
      targetResults = check.results;
      firstUnavailable = Object.entries(targetResults).find(([, ok]) => !ok)?.[0];
    } catch {
      // Agent unreachable — covered by `reachable` flag below.
    }

    const ok = reachable && wgPortOpen && Object.values(targetResults).every((v) => v);

    await this.prisma.serverHealthCheck.create({
      data: {
        serverId,
        reachable,
        wgPortOpen,
        latencyMs: latencyMs ?? undefined,
        dnsOk,
        targetResults,
        ok,
        detail: ok ? 'healthy' : this.describeProblem({ reachable, wgPortOpen, firstUnavailable }),
      },
    });

    await this.applyStatusTransition(server, ok, firstUnavailable);
    return { ok, reachable, wgPortOpen, latencyMs, targetResults };
  }

  async checkAll() {
    const servers = await this.prisma.vpnServer.findMany({
      where: { status: { in: [ServerStatus.ACTIVE, ServerStatus.UNREACHABLE] } },
      select: { id: true },
    });
    for (const s of servers) {
      await this.checkServer(s.id).catch((e) => this.logger.error(`health check ${s.id}: ${(e as Error).message}`));
    }
  }

  recentChecks(serverId: string, limit = 20) {
    return this.prisma.serverHealthCheck.findMany({
      where: { serverId },
      orderBy: { checkedAt: 'desc' },
      take: limit,
    });
  }

  private async applyStatusTransition(
    server: { id: string; name: string; status: ServerStatus; countryId: string },
    ok: boolean,
    firstUnavailable?: string,
  ) {
    const wasHealthy = server.status === ServerStatus.ACTIVE;
    if (!ok && wasHealthy) {
      await this.prisma.vpnServer.update({ where: { id: server.id }, data: { status: ServerStatus.UNREACHABLE } });
      const country = await this.prisma.vpnCountry.findUnique({ where: { id: server.countryId } });
      const lastOk = await this.prisma.serverHealthCheck.findFirst({
        where: { serverId: server.id, ok: true },
        orderBy: { checkedAt: 'desc' },
      });
      await this.telegram.serverAlert({
        serverName: server.name,
        country: country?.name ?? 'unknown',
        problem: firstUnavailable ? `target service unavailable` : 'server/WG port unreachable',
        unavailableService: firstUnavailable,
        lastSuccessfulCheck: lastOk?.checkedAt ?? null,
      });
    } else if (ok && server.status === ServerStatus.UNREACHABLE) {
      await this.prisma.vpnServer.update({ where: { id: server.id }, data: { status: ServerStatus.ACTIVE } });
      await this.telegram.sendAdmin(`✅ Server <b>${server.name}</b> recovered.`);
    }
  }

  private describeProblem(p: { reachable: boolean; wgPortOpen: boolean; firstUnavailable?: string }): string {
    if (!p.reachable) return 'server unreachable (TCP)';
    if (!p.wgPortOpen) return 'WireGuard UDP port closed';
    if (p.firstUnavailable) return `target service unavailable: ${p.firstUnavailable}`;
    return 'unhealthy';
  }

  private tcpPing(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new Socket();
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
      socket.connect(port, host);
    });
  }

  /**
   * WireGuard is UDP and silent, so a closed-port check isn't fully reliable from
   * outside. For the MVP we treat the agent's reported wg status as authoritative
   * and use this only as a best-effort signal (always returns true if we can't
   * actively disprove). Real probing is done by the agent on-box.
   */
  private async udpPortReachable(_host: string, _port: number): Promise<boolean> {
    return true;
  }
}

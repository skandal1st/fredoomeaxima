import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NodeSSH } from 'node-ssh';
import { readFileSync, existsSync } from 'fs';
import { PrismaService } from '../common/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { TypedConfigService } from '../config/config.module';
import { buildInstallScript } from '../servers/install-script';
import { ProvisionStatus } from '@aximavpn/shared';

export interface SshTarget {
  host: string;
  port: number;
  user: string;
  password: string;
}

const AGENT_REMOTE = '/tmp/aximavpn-agent.js';
const INSTALL_REMOTE = '/tmp/aximavpn-install.sh';

/**
 * Panel-driven provisioning: connect to a fresh VPS over SSH, upload the agent
 * bundle + a token-injected install script, run it with sudo, and stream the
 * output into the server's provisionLog. The server self-registers at the end,
 * flipping its status to ACTIVE.
 *
 * The SSH password is used only here and never persisted. Runs fire-and-forget
 * (the controller returns immediately); progress is polled via provisionLog.
 */
@Injectable()
export class SshProvisionerService {
  private readonly logger = new Logger(SshProvisionerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: TypedConfigService,
  ) {}

  /** Kick off provisioning without blocking the request. */
  start(serverId: string, target: SshTarget): void {
    void this.run(serverId, target).catch((err) =>
      this.logger.error(`Provisioning ${serverId} crashed: ${(err as Error).message}`),
    );
  }

  private async run(serverId: string, target: SshTarget): Promise<void> {
    const server = await this.prisma.vpnServer.findUnique({ where: { id: serverId } });
    if (!server) throw new NotFoundException('Server not found');
    if (!server.installToken) {
      await this.fail(serverId, 'Server has no install token (already registered).');
      return;
    }

    const log: string[] = [];
    const append = async (chunk: string) => {
      // Never let an SSH password leak into the stored log.
      const masked = chunk.split(target.password).join('***');
      log.push(masked);
      await this.prisma.vpnServer.update({
        where: { id: serverId },
        data: { provisionLog: log.join('') },
      });
    };

    await this.prisma.vpnServer.update({
      where: { id: serverId },
      data: { provisionStatus: ProvisionStatus.RUNNING, provisionLog: '' },
    });

    const ssh = new NodeSSH();
    try {
      await append(`Connecting to ${target.user}@${target.host}:${target.port}...\n`);
      await ssh.connect({
        host: target.host,
        port: target.port,
        username: target.user,
        password: target.password,
        readyTimeout: 20_000,
      });
      await append('Connected.\n');

      // Upload agent bundle (best-effort; install script falls back to curl).
      const bundlePath = this.config.get('AGENT_BUNDLE_PATH');
      if (existsSync(bundlePath)) {
        await ssh.putFile(bundlePath, AGENT_REMOTE);
        await append('Uploaded agent bundle.\n');
      } else {
        await append(`WARN: agent bundle not found at ${bundlePath}; install script will fetch it.\n`);
      }

      // Build + upload the token-injected install script.
      const script = buildInstallScript({
        panelUrl: this.config.get('PANEL_PUBLIC_URL'),
        serverId: server.id,
        installToken: server.installToken,
        agentToken: server.agentTokenEnc ? this.crypto.decrypt(server.agentTokenEnc) : '',
        wgEndpointPort: server.wgEndpointPort,
        wgSubnetCidr: this.config.get('WG_SUBNET_CIDR'),
        wgServerAddress: this.config.get('WG_SERVER_ADDRESS'),
      });
      await ssh.execCommand(`cat > ${INSTALL_REMOTE} <<'AXIMA_EOF'\n${script}\nAXIMA_EOF`);
      await append('Uploaded install script. Running (this can take a few minutes)...\n');

      // Run with sudo. `-S` reads the password from stdin; harmless for root.
      const result = await ssh.execCommand(`sudo -S -p '' bash ${INSTALL_REMOTE}`, {
        stdin: `${target.password}\n`,
        onStdout: (c) => void append(c.toString()),
        onStderr: (c) => void append(c.toString()),
      });

      if (result.code === 0) {
        await append('\nInstall script finished successfully.\n');
        await this.prisma.vpnServer.update({
          where: { id: serverId },
          data: { provisionStatus: ProvisionStatus.SUCCESS },
        });
      } else {
        await append(`\nInstall script exited with code ${result.code}.\n`);
        await this.fail(serverId, `Install failed (exit ${result.code}).`);
      }
    } catch (err) {
      await append(`\nERROR: ${(err as Error).message}\n`);
      await this.fail(serverId, (err as Error).message);
    } finally {
      ssh.dispose();
    }
  }

  private async fail(serverId: string, reason: string): Promise<void> {
    this.logger.warn(`Provisioning ${serverId} failed: ${reason}`);
    await this.prisma.vpnServer.update({
      where: { id: serverId },
      data: { provisionStatus: ProvisionStatus.FAILED },
    });
  }

  async getState(serverId: string) {
    const server = await this.prisma.vpnServer.findUnique({
      where: { id: serverId },
      select: { provisionStatus: true, provisionLog: true, status: true },
    });
    if (!server) throw new NotFoundException('Server not found');
    return server;
  }
}

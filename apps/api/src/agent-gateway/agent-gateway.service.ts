import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CryptoService } from '../common/crypto.service';

/**
 * HTTP client the panel uses to push commands to a VPN server's agent.
 * Transport is push: panel → agent API, authenticated with the per-server
 * bearer token (stored encrypted in vpn_servers.agentTokenEnc).
 */
export interface AgentServerRef {
  agentUrl: string;
  agentTokenEnc: string | null;
}

export interface AgentStatus {
  wgUp: boolean;
  peerCount: number;
  uptimeSeconds: number;
  serverPublicKey?: string;
}

export interface AgentTargetCheck {
  results: Record<string, boolean>;
  dnsOk: boolean;
}

@Injectable()
export class AgentGatewayService {
  private readonly logger = new Logger(AgentGatewayService.name);

  constructor(private readonly crypto: CryptoService) {}

  private client(server: AgentServerRef): AxiosInstance {
    if (!server.agentTokenEnc) throw new ServiceUnavailableException('Server agent token not set (not registered)');
    const token = this.crypto.decrypt(server.agentTokenEnc);
    return axios.create({
      baseURL: server.agentUrl,
      timeout: 15_000,
      headers: { Authorization: `Bearer ${token}` },
      // Agents commonly use self-signed certs; allow that but keep it explicit.
      // For production, pin the cert or front the agent with a real TLS cert.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
    });
  }

  async addPeer(server: AgentServerRef, params: { publicKey: string; presharedKey: string; allowedIps: string[] }) {
    try {
      await this.client(server).post('/peers', {
        publicKey: params.publicKey,
        presharedKey: params.presharedKey,
        allowedIps: params.allowedIps,
      });
    } catch (err) {
      this.fail('addPeer', err);
    }
  }

  async removePeer(server: AgentServerRef, publicKey: string) {
    try {
      await this.client(server).delete(`/peers/${encodeURIComponent(publicKey)}`);
    } catch (err) {
      this.fail('removePeer', err);
    }
  }

  async restart(server: AgentServerRef) {
    try {
      await this.client(server).post('/restart');
    } catch (err) {
      this.fail('restart', err);
    }
  }

  async getStatus(server: AgentServerRef): Promise<AgentStatus> {
    try {
      const res = await this.client(server).get<AgentStatus>('/status');
      return res.data;
    } catch (err) {
      this.fail('getStatus', err);
    }
  }

  async targetCheck(server: AgentServerRef): Promise<AgentTargetCheck> {
    try {
      const res = await this.client(server).get<AgentTargetCheck>('/target-check');
      return res.data;
    } catch (err) {
      this.fail('targetCheck', err);
    }
  }

  private fail(op: string, err: unknown): never {
    const message = (err as Error).message;
    this.logger.warn(`Agent ${op} failed: ${message}`);
    throw new ServiceUnavailableException(`Agent ${op} failed: ${message}`);
  }
}

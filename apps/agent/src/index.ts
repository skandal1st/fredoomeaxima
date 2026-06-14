/**
 * AximaVPN node agent.
 *
 * A tiny, dependency-free HTTP service that runs on each WireGuard VPS. The
 * central panel pushes peer add/remove commands here (bearer-token auth); the
 * agent also pushes a heartbeat back to the panel and runs on-box target checks
 * (DNS + HTTPS reachability of split-tunnel services from inside the country).
 *
 * Built with Node core only so it bundles to a single agent.js and needs no
 * `npm install` on the server.
 */
import * as http from 'http';
import * as https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { promises as dns } from 'dns';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

const PANEL_URL = process.env.PANEL_URL ?? '';
const SERVER_ID = process.env.SERVER_ID ?? '';
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? '';
const AGENT_PORT = Number(process.env.AGENT_PORT ?? 8443);
const WG_INTERFACE = process.env.WG_INTERFACE ?? 'wg0';

if (!AGENT_TOKEN) {
  console.error('AGENT_TOKEN is required');
  process.exit(1);
}

// Domains the agent probes for the split-tunnel "is the service reachable" check.
const TARGET_PROBES: Record<string, string> = {
  telegram: 'web.telegram.org',
  youtube: 'www.youtube.com',
  instagram: 'www.instagram.com',
  tiktok: 'www.tiktok.com',
  chatgpt: 'chat.openai.com',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  whatsapp: 'web.whatsapp.com',
};

const startedAt = Date.now();

// ──────────────────────────── WireGuard ops ────────────────────────────

async function wgAddPeer(publicKey: string, presharedKey: string, allowedIps: string[]): Promise<void> {
  const pskPath = join(tmpdir(), `psk-${randomUUID()}`);
  writeFileSync(pskPath, presharedKey, { mode: 0o600 });
  try {
    await execFileAsync('wg', [
      'set',
      WG_INTERFACE,
      'peer',
      publicKey,
      'preshared-key',
      pskPath,
      'allowed-ips',
      allowedIps.join(','),
    ]);
    // Persist so peers survive a restart.
    await execFileAsync('sh', ['-c', `wg-quick save ${WG_INTERFACE} || true`]);
  } finally {
    try {
      unlinkSync(pskPath);
    } catch {
      /* ignore */
    }
  }
}

async function wgRemovePeer(publicKey: string): Promise<void> {
  await execFileAsync('wg', ['set', WG_INTERFACE, 'peer', publicKey, 'remove']);
  await execFileAsync('sh', ['-c', `wg-quick save ${WG_INTERFACE} || true`]);
}

async function wgStatus(): Promise<{ wgUp: boolean; peerCount: number }> {
  try {
    const { stdout } = await execFileAsync('wg', ['show', WG_INTERFACE, 'dump']);
    // First line is the interface; remaining lines are peers.
    const lines = stdout.trim().split('\n').filter(Boolean);
    return { wgUp: true, peerCount: Math.max(0, lines.length - 1) };
  } catch {
    return { wgUp: false, peerCount: 0 };
  }
}

async function wgRestart(): Promise<void> {
  await execFileAsync('systemctl', ['restart', `wg-quick@${WG_INTERFACE}`]);
}

// ──────────────────────────── Target checks ────────────────────────────

async function probeTarget(host: string): Promise<boolean> {
  try {
    await dns.resolve4(host);
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const req = https.request({ host, port: 443, method: 'HEAD', path: '/', timeout: 5000 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function runTargetCheck(): Promise<{ results: Record<string, boolean>; dnsOk: boolean }> {
  const results: Record<string, boolean> = {};
  let anyDns = false;
  for (const [key, host] of Object.entries(TARGET_PROBES)) {
    const ok = await probeTarget(host);
    results[key] = ok;
    if (ok) anyDns = true;
  }
  return { results, dnsOk: anyDns };
}

// ──────────────────────────── HTTP server ────────────────────────────

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function authorized(req: http.IncomingMessage): boolean {
  const auth = req.headers['authorization'];
  return typeof auth === 'string' && auth === `Bearer ${AGENT_TOKEN}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${AGENT_PORT}`);
    const path = url.pathname;

    // Health is open; everything else requires the agent token.
    if (req.method === 'GET' && path === '/healthz') return send(res, 200, { status: 'ok' });
    if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });

    if (req.method === 'POST' && path === '/peers') {
      const body = JSON.parse((await readBody(req)) || '{}');
      if (!body.publicKey || !body.presharedKey || !Array.isArray(body.allowedIps)) {
        return send(res, 400, { error: 'publicKey, presharedKey, allowedIps required' });
      }
      await wgAddPeer(body.publicKey, body.presharedKey, body.allowedIps);
      return send(res, 201, { ok: true });
    }

    if (req.method === 'DELETE' && path.startsWith('/peers/')) {
      const publicKey = decodeURIComponent(path.slice('/peers/'.length));
      await wgRemovePeer(publicKey);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && path === '/restart') {
      await wgRestart();
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && path === '/status') {
      const status = await wgStatus();
      return send(res, 200, { ...status, uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
    }

    if (req.method === 'GET' && path === '/target-check') {
      const check = await runTargetCheck();
      return send(res, 200, check);
    }

    return send(res, 404, { error: 'not found' });
  } catch (err) {
    return send(res, 500, { error: (err as Error).message });
  }
});

server.listen(AGENT_PORT, () => {
  console.log(`AximaVPN agent listening on :${AGENT_PORT} (interface ${WG_INTERFACE})`);
});

// ──────────────────────────── Heartbeat ────────────────────────────

async function sendHeartbeat(): Promise<void> {
  if (!PANEL_URL || !SERVER_ID) return;
  const status = await wgStatus();
  const body = JSON.stringify({ peerCount: status.peerCount, wgUp: status.wgUp });
  const target = new URL(`${PANEL_URL}/servers/${SERVER_ID}/heartbeat`);
  const lib = target.protocol === 'https:' ? https : http;
  const req = lib.request(
    {
      method: 'POST',
      host: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: target.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      timeout: 10000,
      // Panel may use a self-signed cert in dev.
      rejectUnauthorized: false,
    } as https.RequestOptions,
    (res) => res.resume(),
  );
  req.on('error', (e) => console.warn(`heartbeat failed: ${e.message}`));
  req.on('timeout', () => req.destroy());
  req.write(body);
  req.end();
}

setInterval(() => {
  sendHeartbeat().catch(() => undefined);
}, 60_000);
// Initial heartbeat shortly after boot.
setTimeout(() => sendHeartbeat().catch(() => undefined), 5_000);

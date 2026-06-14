import { randomBytes } from 'crypto';
import nacl from 'tweetnacl';

/**
 * WireGuard uses Curve25519. We generate keys the same way `wg genkey` /
 * `wg pubkey` do: 32 random bytes, clamped, then scalar-mult base for the public
 * key. Keys are base64-encoded (WireGuard's wire format).
 */
export interface WireguardKeyPair {
  privateKey: string;
  publicKey: string;
}

function clamp(key: Buffer): Buffer {
  key[0] &= 248;
  key[31] &= 127;
  key[31] |= 64;
  return key;
}

export function generateKeyPair(): WireguardKeyPair {
  const priv = clamp(randomBytes(32));
  const pub = nacl.scalarMult.base(new Uint8Array(priv));
  return {
    privateKey: priv.toString('base64'),
    publicKey: Buffer.from(pub).toString('base64'),
  };
}

/** Preshared key — 32 random bytes, base64. Adds a symmetric layer per peer. */
export function generatePresharedKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Short tunnel name for the .conf filename. The WireGuard desktop client derives
 * the tunnel name from the filename and only accepts `^[A-Za-z0-9_=+.-]{1,15}$`,
 * so a full peer CUID is too long. Produces e.g. `Axima-NL-9f3a` (13 chars).
 */
export function buildConfigName(countryCode: string, peerId: string): string {
  const cc = (countryCode || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
  return `Axima-${cc}-${peerId.slice(-4)}`;
}

/**
 * Render a client .conf. AllowedIPs drives the split tunnel — only the supplied
 * CIDRs are routed through the server.
 */
export function renderClientConfig(params: {
  clientPrivateKey: string;
  clientAddress: string; // e.g. 10.66.66.5/32
  dns: string;
  serverPublicKey: string;
  presharedKey: string;
  endpoint: string; // host:port
  allowedIps: string[];
}): string {
  const allowed = params.allowedIps.length > 0 ? params.allowedIps.join(', ') : '0.0.0.0/0';
  return [
    '[Interface]',
    `PrivateKey = ${params.clientPrivateKey}`,
    `Address = ${params.clientAddress}`,
    `DNS = ${params.dns}`,
    '',
    '[Peer]',
    `PublicKey = ${params.serverPublicKey}`,
    `PresharedKey = ${params.presharedKey}`,
    `Endpoint = ${params.endpoint}`,
    `AllowedIPs = ${allowed}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n');
}

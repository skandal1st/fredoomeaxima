/**
 * Minimal IPv4 allocation within a CIDR for assigning peer addresses.
 * Supports the typical wg0 /24..../30 ranges. Skips the network address, the
 * server address (.1 by convention) and the broadcast address.
 */

function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(int: number): string {
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

export interface SubnetInfo {
  network: number;
  broadcast: number;
  prefix: number;
}

export function parseCidr(cidr: string): SubnetInfo {
  const [ip, prefixStr] = cidr.split('/');
  const prefix = Number(prefixStr);
  if (Number.isNaN(prefix) || prefix < 0 || prefix > 32) throw new Error(`Invalid CIDR: ${cidr}`);
  const ipInt = ipToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (ipInt & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast, prefix };
}

/**
 * Returns the first free host IP in `subnetCidr` not present in `usedIps`,
 * skipping the server address. Throws when the pool is exhausted.
 */
export function nextFreeIp(subnetCidr: string, serverAddress: string, usedIps: string[]): string {
  const { network, broadcast } = parseCidr(subnetCidr);
  const serverInt = ipToInt(serverAddress.split('/')[0]);
  const used = new Set(usedIps.map((ip) => ipToInt(ip.split('/')[0])));
  used.add(serverInt);

  for (let candidate = network + 1; candidate < broadcast; candidate++) {
    if (!used.has(candidate)) return intToIp(candidate);
  }
  throw new Error(`Address pool exhausted for subnet ${subnetCidr}`);
}

/** Number of assignable host addresses in a subnet (excluding network/broadcast/server). */
export function poolCapacity(subnetCidr: string): number {
  const { network, broadcast } = parseCidr(subnetCidr);
  return Math.max(0, broadcast - network - 1 - 1); // minus network, broadcast, server
}

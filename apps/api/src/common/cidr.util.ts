/**
 * IPv4 CIDR helpers for building safe, compact split-tunnel route lists.
 *
 * Why this exists: resolved route CIDRs end up verbatim in the client's
 * WireGuard `AllowedIPs`. An unvalidated or oversized list is what made a single
 * bad route take the whole tunnel down (a CIDR overlapping the server Endpoint
 * creates a routing loop) and what bloated the QR code. These functions
 * validate, drop dangerous ranges, collapse many /32s into minimal blocks, and
 * carve the server Endpoint back out.
 *
 * All math is on unsigned 32-bit IPv4 numbers represented as plain JS numbers in
 * [0, 2^32). We avoid bitwise shift operators (which are signed/32-bit in JS and
 * misbehave above 2^31) in favour of arithmetic on these in-range numbers.
 */

const MAX_UINT32 = 0x1_0000_0000; // 2^32

/** Parse a dotted-quad IPv4 address to a number, or null if malformed. */
export function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** Render a number back to a dotted-quad IPv4 address. */
export function intToIp(value: number): string {
  return [
    Math.floor(value / 16777216) % 256,
    Math.floor(value / 65536) % 256,
    Math.floor(value / 256) % 256,
    value % 256,
  ].join('.');
}

export interface ParsedCidr {
  /** Network address (host bits cleared), as a uint32 number. */
  base: number;
  prefix: number;
}

/**
 * Strictly parse an IPv4 CIDR. A bare address is treated as /32. Returns the
 * canonical (network-masked) base, or null if the input is invalid.
 */
export function parseCidr(input: string): ParsedCidr | null {
  const trimmed = input.trim();
  const slash = trimmed.indexOf('/');
  const ipPart = slash === -1 ? trimmed : trimmed.slice(0, slash);
  const prefixPart = slash === -1 ? '32' : trimmed.slice(slash + 1);

  const ip = ipToInt(ipPart);
  if (ip === null) return null;
  if (!/^\d{1,2}$/.test(prefixPart)) return null;
  const prefix = Number(prefixPart);
  if (prefix > 32) return null;

  const hostBits = 32 - prefix;
  const blockSize = Math.pow(2, hostBits);
  const base = ip - (ip % blockSize); // clear host bits
  return { base, prefix };
}

/** Inclusive [start, end] uint32 range covered by a CIDR. */
function cidrToRange(c: ParsedCidr): [number, number] {
  const size = Math.pow(2, 32 - c.prefix);
  return [c.base, c.base + size - 1];
}

/**
 * Reserved / bogon ranges that must never end up in a split tunnel: they either
 * collide with the client's own LAN (breaking local connectivity once routed
 * into the tunnel) or are non-routable. Listed as [start, end] uint32 pairs.
 */
const RESERVED_RANGES: [number, number][] = (
  [
    '0.0.0.0/8', // "this" network
    '10.0.0.0/8', // RFC1918 private
    '100.64.0.0/10', // CGN
    '127.0.0.0/8', // loopback
    '169.254.0.0/16', // link-local
    '172.16.0.0/12', // RFC1918 private
    '192.168.0.0/16', // RFC1918 private
    '224.0.0.0/4', // multicast
    '240.0.0.0/4', // reserved + 255.255.255.255 broadcast
  ] as const
).map((c) => cidrToRange(parseCidr(c)!));

function overlapsReserved(range: [number, number]): boolean {
  return RESERVED_RANGES.some(([rs, re]) => range[0] <= re && rs <= range[1]);
}

/**
 * Drop entries that are malformed, dangerously broad (prefix < 8, e.g.
 * `0.0.0.0/0`), or overlap a reserved/bogon range. Returns canonical CIDR
 * strings. This is the gate that stops a poisoned resolution from reaching a
 * client config.
 */
export function sanitizeCidrs(cidrs: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of cidrs) {
    const parsed = parseCidr(raw);
    if (!parsed) continue;
    if (parsed.prefix < 8) continue; // too broad to be a deliberate resource route
    const range = cidrToRange(parsed);
    if (overlapsReserved(range)) continue;
    const canonical = `${intToIp(parsed.base)}/${parsed.prefix}`;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
  }
  return out;
}

/** Number of trailing zero bits of a positive uint32 (max block alignment). */
function trailingZeros(n: number): number {
  let count = 0;
  let value = n;
  while ((value & 1) === 0) {
    value = Math.floor(value / 2);
    count++;
  }
  return count;
}

/** Minimal list of CIDR blocks exactly covering inclusive range [start, end]. */
function rangeToCidrs(start: number, end: number): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    // Largest block we can start here is bounded by cur's alignment...
    let size = cur === 0 ? 32 : trailingZeros(cur);
    // ...and by how many addresses remain.
    while (size > 0 && cur + Math.pow(2, size) - 1 > end) size--;
    out.push(`${intToIp(cur)}/${32 - size}`);
    cur += Math.pow(2, size); // may reach 2^32 at the very top, ending the loop
    if (cur >= MAX_UINT32) break;
  }
  return out;
}

/** Merge a set of CIDRs into sorted, non-overlapping inclusive ranges. */
function toMergedRanges(cidrs: string[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const raw of cidrs) {
    const parsed = parseCidr(raw);
    if (parsed) ranges.push(cidrToRange(parsed));
  }
  ranges.sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1];
    // Merge on overlap OR adjacency (last.end + 1 === s).
    if (last && s <= last[1] + 1) {
      if (e > last[1]) last[1] = e;
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/**
 * Collapse overlapping/adjacent CIDRs into the minimal equivalent set. This is
 * what shrinks dozens of per-host /32s from one provider into a handful of
 * blocks — keeping `AllowedIPs` (and the QR payload) compact.
 */
export function aggregateCidrs(cidrs: string[]): string[] {
  return toMergedRanges(cidrs).flatMap(([s, e]) => rangeToCidrs(s, e));
}

/**
 * Remove a single host IP (the server Endpoint) from a CIDR set, splitting any
 * covering block around it. Routing the Endpoint into the tunnel creates a
 * handshake loop that kills connectivity, so it must always stay outside
 * `AllowedIPs`. Invalid `ip` is treated as a no-op (still aggregated).
 */
export function excludeIpFromCidrs(cidrs: string[], ip: string): string[] {
  const target = ipToInt(ip);
  const ranges = toMergedRanges(cidrs);
  if (target === null) return ranges.flatMap(([s, e]) => rangeToCidrs(s, e));

  const out: string[] = [];
  for (const [s, e] of ranges) {
    if (target < s || target > e) {
      out.push(...rangeToCidrs(s, e));
      continue;
    }
    if (s <= target - 1) out.push(...rangeToCidrs(s, target - 1));
    if (target + 1 <= e) out.push(...rangeToCidrs(target + 1, e));
  }
  return out;
}

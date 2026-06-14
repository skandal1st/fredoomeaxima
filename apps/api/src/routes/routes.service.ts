import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { PrismaService } from '../common/prisma.service';
import { sanitizeCidrs, aggregateCidrs } from '../common/cidr.util';
import { UpsertRouteGroupInput } from '@aximavpn/shared';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(private readonly prisma: PrismaService) {}

  listGroups() {
    return this.prisma.routeGroup.findMany({ orderBy: { name: 'asc' } });
  }

  async upsertGroup(input: UpsertRouteGroupInput) {
    return this.prisma.routeGroup.upsert({
      where: { key: input.key },
      update: { name: input.name, domains: input.domains, isEnabled: input.isEnabled },
      create: { key: input.key, name: input.name, domains: input.domains, isEnabled: input.isEnabled },
    });
  }

  async setEnabled(key: string, isEnabled: boolean) {
    const group = await this.prisma.routeGroup.findUnique({ where: { key } });
    if (!group) throw new NotFoundException('Route group not found');
    return this.prisma.routeGroup.update({ where: { key }, data: { isEnabled } });
  }

  /** The current (latest) route list version, with its CIDR entries. */
  async getCurrentVersion() {
    return this.prisma.routeListVersion.findFirst({
      orderBy: { version: 'desc' },
      include: { entries: { include: { routeGroup: { select: { key: true, name: true } } } } },
    });
  }

  /** AllowedIPs for a peer config — deduped CIDRs of the current version. */
  async getCurrentAllowedIps(): Promise<{ versionId: string | null; cidrs: string[] }> {
    const version = await this.getCurrentVersion();
    if (!version) return { versionId: null, cidrs: [] };
    const cidrs = Array.from(new Set(version.entries.map((e) => e.cidr))).sort();
    return { versionId: version.id, cidrs };
  }

  /**
   * Resolve all enabled route groups' domains to IPv4 CIDRs and persist a new
   * route list version. Peers built on an older version are flagged needsUpdate.
   *
   * IMPORTANT: domain→IP coverage is approximate (CDNs/QUIC/rotating ranges).
   * Resolving frequently and allowing manual CIDRs mitigates but does not
   * eliminate gaps — this is by design, see plan risks.
   */
  async resolveAndPublish(note?: string): Promise<{ version: number; entryCount: number; changed: boolean }> {
    const groups = await this.prisma.routeGroup.findMany({ where: { isEnabled: true } });
    const current = await this.getCurrentVersion();

    // Last-known-good CIDRs per group, to fall back on when resolution yields
    // nothing (transient DNS failure must not wipe a working group).
    const prevByGroup = new Map<string, string[]>();
    for (const e of current?.entries ?? []) {
      const list = prevByGroup.get(e.routeGroupId) ?? [];
      list.push(e.cidr);
      prevByGroup.set(e.routeGroupId, list);
    }

    const resolved: { routeGroupId: string; cidr: string }[] = [];
    for (const group of groups) {
      // Resolve each group in isolation so one bad group can't poison the rest.
      const rawCidrs: string[] = [];
      for (const domain of group.domains) {
        rawCidrs.push(...(await this.resolveDomain(domain)));
      }
      // Validate (drop bogons/over-broad/malformed) then compact this group's
      // routes — this is what keeps AllowedIPs/QR small and the tunnel safe.
      let groupCidrs = aggregateCidrs(sanitizeCidrs(rawCidrs));
      if (groupCidrs.length === 0) {
        const prev = prevByGroup.get(group.id);
        if (prev && prev.length > 0) {
          this.logger.warn(`Route group "${group.key}" resolved to 0 CIDRs; keeping previous ${prev.length}.`);
          groupCidrs = prev;
        }
      }
      for (const cidr of groupCidrs) resolved.push({ routeGroupId: group.id, cidr });
    }

    // Dedup per (group, cidr).
    const seen = new Set<string>();
    const unique = resolved.filter((r) => {
      const k = `${r.routeGroupId}|${r.cidr}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // Anti-poison: never replace a non-empty published list with an empty one
    // (e.g. total DNS outage). Keep serving the last good version.
    if (unique.length === 0 && (current?.entries.length ?? 0) > 0) {
      this.logger.warn(`Resolved 0 route entries; keeping current v${current!.version} (anti-poison).`);
      return { version: current!.version, entryCount: current!.entries.length, changed: false };
    }

    // Skip publishing if nothing changed vs the latest version (avoid version churn).
    const currentSet = new Set((current?.entries ?? []).map((e) => `${e.routeGroupId}|${e.cidr}`));
    const newSet = new Set(unique.map((r) => `${r.routeGroupId}|${r.cidr}`));
    const changed = currentSet.size !== newSet.size || [...newSet].some((k) => !currentSet.has(k));
    if (!changed && current) {
      this.logger.log(`Route list unchanged (v${current.version}); skipping publish.`);
      return { version: current.version, entryCount: unique.length, changed: false };
    }

    const nextVersion = (current?.version ?? 0) + 1;
    await this.prisma.$transaction(async (tx) => {
      const version = await tx.routeListVersion.create({
        data: { version: nextVersion, note: note ?? null },
      });
      if (unique.length > 0) {
        await tx.routeEntry.createMany({
          data: unique.map((r) => ({ versionId: version.id, routeGroupId: r.routeGroupId, cidr: r.cidr })),
        });
      }
      // Flag all active peers not on the new version as needing an update.
      await tx.wireguardPeer.updateMany({
        where: { status: 'ACTIVE', NOT: { routeListVersionId: version.id } },
        data: { needsUpdate: true },
      });
    });

    this.logger.log(`Published route list v${nextVersion} with ${unique.length} entries.`);
    return { version: nextVersion, entryCount: unique.length, changed: true };
  }

  /** Resolve a single domain to /32 host CIDRs (IPv4). Failures are tolerated. */
  private async resolveDomain(domain: string): Promise<string[]> {
    try {
      const addrs = await dns.resolve4(domain);
      return addrs.map((ip) => `${ip}/32`);
    } catch (err) {
      this.logger.debug(`resolve4 failed for ${domain}: ${(err as Error).message}`);
      return [];
    }
  }
}

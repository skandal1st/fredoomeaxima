/**
 * Standalone assertions for cidr.util (the repo has no jest runner; run with
 * `pnpm --filter @aximavpn/api exec tsx src/common/cidr.util.check.ts`).
 * Exits non-zero on the first failed assertion.
 */
import { aggregateCidrs, sanitizeCidrs, excludeIpFromCidrs, parseCidr } from './cidr.util';

let passed = 0;

function eq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
    process.exit(1);
  }
  passed++;
}

function ok(label: string, cond: boolean): void {
  if (!cond) {
    console.error(`FAIL ${label}`);
    process.exit(1);
  }
  passed++;
}

// aggregateCidrs collapses adjacency/containment into the minimal set.
eq(
  'aggregate adjacency+containment',
  aggregateCidrs(['1.1.1.1/32', '1.1.1.0/24', '1.1.1.2/32']),
  ['1.1.1.0/24'],
);
eq('aggregate two adjacent /25 -> /24', aggregateCidrs(['8.8.8.0/25', '8.8.8.128/25']), ['8.8.8.0/24']);
eq('aggregate non-adjacent stays split', aggregateCidrs(['8.8.8.0/24', '8.8.10.0/24']), [
  '8.8.8.0/24',
  '8.8.10.0/24',
]);

// sanitizeCidrs drops broad/private/malformed, keeps valid public hosts.
eq(
  'sanitize drops broad/private/garbage',
  sanitizeCidrs(['0.0.0.0/0', '10.0.0.1/32', '8.8.8.8/32', 'garbage', '192.168.1.0/24']),
  ['8.8.8.8/32'],
);
eq('sanitize canonicalizes host bits', sanitizeCidrs(['8.8.8.8/24']), ['8.8.8.0/24']);

// excludeIpFromCidrs carves out the endpoint /32 while covering the remainder.
const carved = excludeIpFromCidrs(['8.8.8.0/24'], '8.8.8.8');
ok('exclude removes the endpoint /32', !carved.includes('8.8.8.8/32'));
// The carved blocks must cover the whole /24 except exactly 8.8.8.8.
const covered = new Set<number>();
for (const c of carved) {
  const p = parseCidr(c)!;
  for (let i = 0; i < Math.pow(2, 32 - p.prefix); i++) covered.add(p.base + i);
}
ok('exclude still covers 8.8.8.7', covered.has(parseCidr('8.8.8.7')!.base));
ok('exclude still covers 8.8.8.9', covered.has(parseCidr('8.8.8.9')!.base));
ok('exclude no longer covers 8.8.8.8', !covered.has(parseCidr('8.8.8.8')!.base));
eq('exclude covers 255 of 256 addresses', covered.size, 255);

// endpoint outside the set is left untouched (just aggregated).
eq('exclude endpoint not in set is no-op', excludeIpFromCidrs(['8.8.8.0/24'], '9.9.9.9'), ['8.8.8.0/24']);

console.log(`OK — ${passed} assertions passed`);

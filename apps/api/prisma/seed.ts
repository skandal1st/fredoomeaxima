/**
 * Idempotent seed: default admin, a starter tariff, a few countries and the
 * default split-tunnel route groups. Safe to run multiple times.
 *
 * Run: pnpm --filter @aximavpn/api prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_ROUTE_GROUPS } from '@aximavpn/shared';

const prisma = new PrismaClient();

const COUNTRIES = [
  { code: 'NL', name: 'Netherlands', flagEmoji: '🇳🇱' },
  { code: 'DE', name: 'Germany', flagEmoji: '🇩🇪' },
  { code: 'FI', name: 'Finland', flagEmoji: '🇫🇮' },
  { code: 'US', name: 'United States', flagEmoji: '🇺🇸' },
];

async function main() {
  // ── Countries ──
  for (const c of COUNTRIES) {
    await prisma.vpnCountry.upsert({
      where: { code: c.code },
      update: { name: c.name, flagEmoji: c.flagEmoji },
      create: c,
    });
  }
  const allCountries = await prisma.vpnCountry.findMany();

  // ── Default admin ──
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@aximavpn.local';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMe_Admin123';
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: 'ADMIN' },
    create: { email: adminEmail, passwordHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  console.log(`Admin ensured: ${adminEmail}`);

  // ── Starter tariff ──
  const existingTariff = await prisma.tariff.findFirst({ where: { name: 'Standard Monthly' } });
  if (!existingTariff) {
    await prisma.tariff.create({
      data: {
        name: 'Standard Monthly',
        priceCents: 19900, // 199.00 RUB
        currency: 'RUB',
        durationDays: 30,
        deviceLimit: 3,
        isActive: true,
        allowedCountries: { connect: allCountries.map((c) => ({ id: c.id })) },
      },
    });
    console.log('Created tariff: Standard Monthly');
  }

  // ── Route groups ──
  for (const g of DEFAULT_ROUTE_GROUPS) {
    await prisma.routeGroup.upsert({
      where: { key: g.key },
      update: { name: g.name, domains: g.domains },
      create: { key: g.key, name: g.name, domains: g.domains, isEnabled: true },
    });
  }
  console.log(`Route groups ensured: ${DEFAULT_ROUTE_GROUPS.length}`);

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

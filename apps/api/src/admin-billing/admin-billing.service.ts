import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PaymentStatus } from '@aximavpn/shared';

/**
 * Admin infrastructure billing: monthly VPS spend vs user revenue vs margin.
 * Costs are normalised to a single reporting currency (costCurrency may differ
 * per server; for MVP we report per-currency subtotals plus a naive total that
 * assumes one currency — real FX conversion is a later enhancement).
 */
@Injectable()
export class AdminBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const servers = await this.prisma.vpnServer.findMany({
      include: { country: { select: { code: true, name: true } } },
      orderBy: { nextRenewalAt: 'asc' },
    });

    // Monthly cost grouped by currency.
    const costByCurrency: Record<string, number> = {};
    for (const s of servers) {
      costByCurrency[s.costCurrency] = (costByCurrency[s.costCurrency] ?? 0) + s.monthlyCostCents;
    }

    // Revenue this calendar month (succeeded + manual payments).
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.SUCCEEDED, PaymentStatus.MANUAL] },
        paidAt: { gte: monthStart },
      },
      select: { amountCents: true, currency: true },
    });
    const revenueByCurrency: Record<string, number> = {};
    for (const p of payments) {
      revenueByCurrency[p.currency] = (revenueByCurrency[p.currency] ?? 0) + p.amountCents;
    }

    const upcomingRenewals = servers
      .filter((s) => s.nextRenewalAt)
      .map((s) => ({
        serverId: s.id,
        name: s.name,
        country: s.country.name,
        provider: s.provider,
        monthlyCostCents: s.monthlyCostCents,
        costCurrency: s.costCurrency,
        nextRenewalAt: s.nextRenewalAt,
      }));

    return {
      servers: servers.map((s) => ({
        id: s.id,
        name: s.name,
        country: s.country.name,
        provider: s.provider,
        monthlyCostCents: s.monthlyCostCents,
        costCurrency: s.costCurrency,
        nextRenewalAt: s.nextRenewalAt,
        status: s.status,
      })),
      monthlyCostByCurrency: costByCurrency,
      revenueThisMonthByCurrency: revenueByCurrency,
      upcomingRenewals,
      // Naive single-currency margin hint (only meaningful if cost & revenue share a currency).
      note: 'Margin = revenue − cost per currency. Cross-currency FX not applied in MVP.',
    };
  }
}

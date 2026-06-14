import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HealthService } from './health.service';
import { PrismaService } from '../common/prisma.service';
import { TelegramService } from '../notifications/telegram.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ServerStatus } from '@aximavpn/shared';

@Injectable()
export class HealthScheduler {
  private readonly logger = new Logger(HealthScheduler.name);

  constructor(
    private readonly health: HealthService,
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runHealthChecks() {
    await this.health.checkAll();
  }

  /** Flag servers that haven't sent a heartbeat in >10 min as unreachable. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async heartbeatWatchdog() {
    const cutoff = new Date(Date.now() - 10 * 60_000);
    const stale = await this.prisma.vpnServer.findMany({
      where: { status: ServerStatus.ACTIVE, registeredAt: { not: null }, lastHeartbeatAt: { lt: cutoff } },
      include: { country: true },
    });
    for (const s of stale) {
      await this.prisma.vpnServer.update({ where: { id: s.id }, data: { status: ServerStatus.UNREACHABLE } });
      await this.telegram.serverAlert({
        serverName: s.name,
        country: s.country.name,
        problem: 'no heartbeat for >10 minutes',
        lastSuccessfulCheck: s.lastHeartbeatAt,
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireSubscriptions() {
    const count = await this.subscriptions.expireDue();
    if (count > 0) this.logger.log(`Expired ${count} subscriptions.`);
  }

  /** Daily reminder for VPS renewals due within 5 days. */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async vpsRenewalReminders() {
    const soon = new Date(Date.now() + 5 * 86_400_000);
    const due = await this.prisma.vpnServer.findMany({
      where: { nextRenewalAt: { not: null, lte: soon } },
      include: { country: true },
    });
    for (const s of due) {
      await this.telegram.sendAdmin(
        `🗓 VPS renewal due: <b>${s.name}</b> (${s.country.name}) on ${s.nextRenewalAt?.toISOString().slice(0, 10)} — ${(s.monthlyCostCents / 100).toFixed(2)} ${s.costCurrency}`,
      );
    }
  }
}

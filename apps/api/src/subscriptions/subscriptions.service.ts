import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SubscriptionStatus, SubscriptionSource } from '@aximavpn/shared';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active subscription for a user, or null. Single source of truth for "can use VPN". */
  async getActive(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
      include: { tariff: { include: { allowedCountries: true } } },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { tariff: { select: { name: true, deviceLimit: true } } },
    });
  }

  /**
   * Grant or extend a subscription. If an active subscription exists it is
   * extended from its current end date; otherwise a new one starts now.
   * Used by both admin manual grants and successful payments.
   */
  async grantOrExtend(params: {
    userId: string;
    tariffId: string;
    durationDays?: number;
    source: SubscriptionSource;
  }) {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: params.tariffId } });
    if (!tariff) throw new NotFoundException('Tariff not found');
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) throw new NotFoundException('User not found');

    const days = params.durationDays ?? tariff.durationDays;
    const active = await this.getActive(params.userId);

    if (active) {
      const newEnd = new Date(active.endsAt.getTime() + days * 86_400_000);
      return this.prisma.subscription.update({
        where: { id: active.id },
        data: { endsAt: newEnd, tariffId: tariff.id, source: params.source },
        include: { tariff: true },
      });
    }

    const now = new Date();
    return this.prisma.subscription.create({
      data: {
        userId: params.userId,
        tariffId: tariff.id,
        status: SubscriptionStatus.ACTIVE,
        source: params.source,
        startsAt: now,
        endsAt: new Date(now.getTime() + days * 86_400_000),
      },
      include: { tariff: true },
    });
  }

  async cancel(subscriptionId: string) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: SubscriptionStatus.CANCELLED },
    });
  }

  /** Sweep expired subscriptions; returns count updated. Called by the scheduler. */
  async expireDue(): Promise<number> {
    const res = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.ACTIVE, endsAt: { lte: new Date() } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    return res.count;
  }
}

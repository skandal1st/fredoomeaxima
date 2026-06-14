import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UserStatus, SubscriptionStatus } from '@aximavpn/shared';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async list(params: { limit?: number; cursor?: string; search?: string } = {}) {
    const limit = Math.min(params.limit ?? 50, 200);
    return this.prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: params.search ? { email: { contains: params.search, mode: 'insensitive' } } : undefined,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: PUBLIC_USER_SELECT,
    });
  }

  /** Full admin-facing card: user + subscriptions + payments + peers. */
  async getCard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...PUBLIC_USER_SELECT,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { tariff: { select: { name: true, deviceLimit: true } } },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
        peers: {
          where: { status: 'ACTIVE' },
          include: { server: { select: { name: true, country: { select: { code: true } } } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getActiveSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE, endsAt: { gt: new Date() } },
      orderBy: { endsAt: 'desc' },
      include: { tariff: true },
    });
  }

  async setStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: PUBLIC_USER_SELECT,
    });
    if (status === UserStatus.BLOCKED) {
      await this.auth.revokeAllForUser(userId);
    }
    return updated;
  }
}

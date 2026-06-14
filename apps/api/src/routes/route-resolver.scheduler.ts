import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoutesService } from './routes.service';
import { PrismaService } from '../common/prisma.service';

/**
 * Periodically re-resolves split-tunnel domains. Service IP ranges (YouTube,
 * Telegram, Meta, TikTok…) shift often, so a scheduled re-resolve keeps the
 * route list fresh; changed ranges publish a new version and flag affected peers.
 */
@Injectable()
export class RouteResolverScheduler implements OnModuleInit {
  private readonly logger = new Logger(RouteResolverScheduler.name);

  constructor(
    private readonly routes: RoutesService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Ensure there's an initial route list version on first boot.
    const current = await this.prisma.routeListVersion.findFirst();
    if (!current) {
      this.logger.log('No route list version yet — performing initial resolve.');
      await this.routes.resolveAndPublish('initial boot resolve').catch((e) =>
        this.logger.error(`Initial resolve failed: ${(e as Error).message}`),
      );
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledResolve() {
    this.logger.log('Scheduled route resolve starting...');
    try {
      const result = await this.routes.resolveAndPublish('scheduled resolve');
      this.logger.log(`Scheduled resolve done: v${result.version}, changed=${result.changed}`);
    } catch (e) {
      this.logger.error(`Scheduled resolve failed: ${(e as Error).message}`);
    }
  }
}

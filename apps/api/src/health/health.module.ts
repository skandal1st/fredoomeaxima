import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthScheduler } from './health.scheduler';
import { HealthController } from './health.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [HealthController],
  providers: [HealthService, HealthScheduler],
  exports: [HealthService],
})
export class HealthModule {}

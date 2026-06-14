import { Module } from '@nestjs/common';
import { AdminBillingService } from './admin-billing.service';
import { AdminBillingController } from './admin-billing.controller';

@Module({
  controllers: [AdminBillingController],
  providers: [AdminBillingService],
})
export class AdminBillingModule {}

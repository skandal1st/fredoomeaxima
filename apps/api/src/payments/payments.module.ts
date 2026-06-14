import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { MockPaymentProvider } from './providers/mock.provider';
import { YooKassaProvider } from './providers/yookassa.provider';
import { TypedConfigService } from '../config/config.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: TypedConfigService) => {
        const provider = config.get('PAYMENT_PROVIDER');
        if (provider === 'yookassa') {
          return new YooKassaProvider(config.get('YOOKASSA_SHOP_ID'), config.get('YOOKASSA_SECRET_KEY'));
        }
        return new MockPaymentProvider();
      },
      inject: [TypedConfigService],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}

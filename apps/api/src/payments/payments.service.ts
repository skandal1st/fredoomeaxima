import { Inject, Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { TypedConfigService } from '../config/config.module';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { PaymentStatus, SubscriptionSource } from '@aximavpn/shared';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: TypedConfigService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Start a checkout for a tariff. Returns a confirmation URL (or settles immediately for mock). */
  async checkout(userId: string, tariffId: string) {
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff || !tariff.isActive) throw new NotFoundException('Tariff not available');

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        tariffId,
        amountCents: tariff.priceCents,
        currency: tariff.currency,
        status: PaymentStatus.PENDING,
        provider: this.provider.name,
      },
    });

    const result = await this.provider.createPayment({
      paymentId: payment.id,
      amountCents: tariff.priceCents,
      currency: tariff.currency,
      description: `AximaVPN — ${tariff.name}`,
      returnUrl: `${this.config.get('WEB_PUBLIC_URL')}/dashboard/billing`,
    });

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerTxnId: result.providerTxnId },
    });

    if (result.settled) {
      await this.markSucceeded(payment.id);
    }

    return {
      paymentId: payment.id,
      confirmationUrl: result.confirmationUrl,
      settled: result.settled,
    };
  }

  async handleWebhook(headers: Record<string, string>, rawBody: string) {
    const verdict = await this.provider.handleWebhook(headers, rawBody);
    if (verdict.kind === 'ignored') return { handled: false };

    const payment = await this.findByTxnOrId(verdict.providerTxnId, verdict.paymentId);
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment txn=${verdict.providerTxnId}`);
      return { handled: false };
    }

    if (verdict.kind === 'succeeded') {
      await this.markSucceeded(payment.id);
    } else {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    }
    return { handled: true };
  }

  /** Idempotently mark a payment succeeded and grant/extend the subscription. */
  private async markSucceeded(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.SUCCEEDED) return; // already processed

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCEEDED, paidAt: new Date() },
    });

    if (payment.tariffId) {
      await this.subscriptions.grantOrExtend({
        userId: payment.userId,
        tariffId: payment.tariffId,
        source: SubscriptionSource.PAYMENT,
      });
    }
  }

  /** Admin: mark a pending/failed payment as paid manually (stage-1 flow). */
  async markManuallyPaid(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.SUCCEEDED) throw new BadRequestException('Payment already succeeded');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.MANUAL, paidAt: new Date() },
    });
    if (payment.tariffId) {
      await this.subscriptions.grantOrExtend({
        userId: payment.userId,
        tariffId: payment.tariffId,
        source: SubscriptionSource.MANUAL,
      });
    }
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  listForUser(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { tariff: { select: { name: true } } },
    });
  }

  listAll(params: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(params.limit ?? 50, 200);
    return this.prisma.payment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { tariff: { select: { name: true } }, user: { select: { email: true } } },
    });
  }

  private findByTxnOrId(providerTxnId: string, paymentId?: string) {
    if (paymentId) return this.prisma.payment.findUnique({ where: { id: paymentId } });
    return this.prisma.payment.findUnique({ where: { providerTxnId } });
  }
}

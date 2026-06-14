import axios from 'axios';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  WebhookVerdict,
} from '../payment-provider.interface';

/**
 * YooKassa adapter skeleton (RU/CIS card payments).
 * Docs: https://yookassa.ru/developers/api
 *
 * Real activation requires a merchant shopId + secretKey. The request/response
 * shapes below follow YooKassa's API so this becomes production-ready by adding
 * credentials and verifying webhook source IPs. Webhook signature on YooKassa is
 * done via source-IP allow-listing + re-fetching the payment object; for MVP we
 * re-fetch the payment to confirm status (the safe path) rather than trusting the
 * notification body.
 */
export class YooKassaProvider implements PaymentProvider {
  readonly name = 'yookassa';
  private readonly logger = new Logger(YooKassaProvider.name);
  private readonly base = 'https://api.yookassa.ru/v3';

  constructor(
    private readonly shopId: string,
    private readonly secretKey: string,
  ) {}

  private auth() {
    return { username: this.shopId, password: this.secretKey };
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const res = await axios.post(
      `${this.base}/payments`,
      {
        amount: { value: (params.amountCents / 100).toFixed(2), currency: params.currency },
        capture: true,
        confirmation: { type: 'redirect', return_url: params.returnUrl },
        description: params.description,
        metadata: { paymentId: params.paymentId },
      },
      {
        auth: this.auth(),
        headers: { 'Idempotence-Key': params.paymentId, 'Content-Type': 'application/json' },
        timeout: 15_000,
      },
    );
    const data = res.data as {
      id: string;
      status: string;
      confirmation?: { confirmation_url?: string };
    };
    return {
      providerTxnId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url ?? null,
      settled: data.status === 'succeeded',
    };
  }

  async handleWebhook(_headers: Record<string, string>, rawBody: string): Promise<WebhookVerdict> {
    let notification: { event?: string; object?: { id?: string; metadata?: { paymentId?: string } } };
    try {
      notification = JSON.parse(rawBody);
    } catch {
      return { kind: 'ignored' };
    }
    const providerTxnId = notification.object?.id;
    if (!providerTxnId) return { kind: 'ignored' };

    // Re-fetch the payment to avoid trusting the unsigned notification body.
    try {
      const res = await axios.get(`${this.base}/payments/${providerTxnId}`, { auth: this.auth(), timeout: 15_000 });
      const status = (res.data as { status?: string }).status;
      const paymentId = notification.object?.metadata?.paymentId;
      if (status === 'succeeded') return { kind: 'succeeded', providerTxnId, paymentId };
      if (status === 'canceled') return { kind: 'failed', providerTxnId, paymentId };
      return { kind: 'ignored' };
    } catch (err) {
      this.logger.error(`YooKassa verify failed: ${(err as Error).message}`);
      return { kind: 'ignored' };
    }
  }
}

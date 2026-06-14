import { randomUUID } from 'crypto';
import {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  WebhookVerdict,
} from '../payment-provider.interface';

/**
 * Dev/test provider. Creates a transaction id and reports the payment as settled
 * immediately, so the full grant-subscription flow can be exercised without a
 * real gateway. The architecture (interface, webhook handler) stays identical to
 * production providers.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    return {
      providerTxnId: `mock_${params.paymentId}_${randomUUID().slice(0, 8)}`,
      confirmationUrl: null,
      settled: true,
    };
  }

  async handleWebhook(_headers: Record<string, string>, rawBody: string): Promise<WebhookVerdict> {
    // Allows manual simulation: POST a body like {"providerTxnId":"...","status":"succeeded"}.
    try {
      const body = JSON.parse(rawBody) as { providerTxnId?: string; paymentId?: string; status?: string };
      if (body.status === 'succeeded' && body.providerTxnId) {
        return { kind: 'succeeded', providerTxnId: body.providerTxnId, paymentId: body.paymentId };
      }
      if (body.status === 'failed' && body.providerTxnId) {
        return { kind: 'failed', providerTxnId: body.providerTxnId, paymentId: body.paymentId };
      }
    } catch {
      /* ignore malformed */
    }
    return { kind: 'ignored' };
  }
}

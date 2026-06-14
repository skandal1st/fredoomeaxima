/**
 * Provider-agnostic payment abstraction. Adapters (mock, yookassa, …) implement
 * this so the rest of the app never depends on a concrete gateway. Adding a real
 * provider = one new class + wiring in PaymentsModule.
 */

export interface CreatePaymentParams {
  paymentId: string; // our internal Payment.id, used as idempotency key
  amountCents: number;
  currency: string;
  description: string;
  /** Where the gateway should redirect the user back to after payment. */
  returnUrl: string;
}

export interface CreatePaymentResult {
  /** Gateway-side transaction id. */
  providerTxnId: string;
  /** URL to redirect the user to in order to pay (null for instant/mock). */
  confirmationUrl: string | null;
  /** True if the payment already settled synchronously (mock auto-confirm). */
  settled: boolean;
}

export type WebhookVerdict =
  | { kind: 'succeeded'; providerTxnId: string; paymentId?: string }
  | { kind: 'failed'; providerTxnId: string; paymentId?: string }
  | { kind: 'ignored' };

export interface PaymentProvider {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  /**
   * Parse + verify a webhook callback. Implementations must validate signatures
   * before trusting the payload.
   */
  handleWebhook(headers: Record<string, string>, rawBody: string): Promise<WebhookVerdict>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

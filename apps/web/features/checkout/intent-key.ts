import { createHash } from 'node:crypto';

/**
 * One PaymentIntent per checkout visit (launch QA A-5). Pure helpers for /api/checkout (payment-intent.ts), with
 * unit tests (tests/checkout-intent-key.test.ts).
 */

/** A PaymentIntent's client secret: `pi_…_secret_…`. Holding it is what lets a browser reuse its payment. */
const CLIENT_SECRET = /^(pi_[A-Za-z0-9]+)_secret_[A-Za-z0-9]+$/;

export function intentIdFromSecret(secret: string): string | null {
  return CLIENT_SECRET.exec(secret)?.[1] ?? null;
}

export interface ReusableIntentFields {
  id: string;
  client_secret: string | null;
  status: string;
  metadata: Record<string, string> | null;
}

/**
 * The browser may keep its payment only when it proves it holds that payment's secret, the payment is ours and
 * nothing has been paid or tried on it yet (any other status gets a fresh payment).
 */
export function canReuseIntent(intent: ReusableIntentFields, secret: string): boolean {
  return (
    intent.client_secret === secret &&
    intent.status === 'requires_payment_method' &&
    intent.metadata?.source === 'iwc'
  );
}

export interface IntentKeyInput {
  email: string;
  userId: string | null;
  totalCents: number;
  shippingMethod: string;
  promoCode: string | null;
  address: Record<string, string | null | undefined>;
  lines: { variantId: string; quantity: number }[];
}

/** Ten minutes: a double submit lands in the same window; Stripe forgets a key after 24 hours anyway. */
const WINDOW_MS = 10 * 60 * 1000;

/**
 * The Idempotency-Key for creating a payment: the same priced bag, details and total in the same ten minutes is
 * the same payment, so a double click or a retried request never creates two.
 */
export function checkoutIdempotencyKey(input: IntentKeyInput, now: Date): string {
  const lines = [...input.lines]
    .sort((a, b) => a.variantId.localeCompare(b.variantId))
    .map((l) => `${l.variantId}x${l.quantity}`);
  const address = Object.keys(input.address)
    .sort()
    .map((k) => `${k}=${input.address[k] ?? ''}`);
  const material = JSON.stringify([
    input.email.toLowerCase(),
    input.userId,
    input.totalCents,
    input.shippingMethod,
    input.promoCode,
    address,
    lines,
    Math.floor(now.getTime() / WINDOW_MS),
  ]);
  return `iwc-checkout-${createHash('sha256').update(material).digest('hex').slice(0, 48)}`;
}

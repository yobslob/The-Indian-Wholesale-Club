import { paymentMatchesCheckout } from '@/features/checkout/payment-check';

/** Marks the PaymentIntents of the faster-delivery offer (D-064), so the webhook knows which flow they belong to. */
export const FASTER_KIND = 'faster_delivery';

export interface FasterIntent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  livemode: boolean;
  metadata: Record<string, string | undefined>;
}

export interface FasterMove {
  offer_status: string;
  offer_cents: number | null;
  payment_intent_id: string | null;
}

/**
 * What to do with a payment for the offer (D-064). Pure, so it has unit tests (tests/faster-decision.test.ts):
 * 'done' = already accepted with this payment (the browser and the webhook both came), 'accept' = it pays for the
 * open offer exactly, 'refund' = it paid for an offer that closed or a different price, 'pending' / 'unknown' = leave.
 */
export function fasterDecision(
  intent: FasterIntent,
  move: FasterMove | null,
  stripeSecretKey: string,
): 'done' | 'accept' | 'refund' | 'pending' | 'unknown' {
  if (intent.metadata.kind !== FASTER_KIND || !intent.metadata.move_id || !move) return 'unknown';
  if (intent.status !== 'succeeded') return 'pending';
  if (move.offer_status === 'accepted' && move.payment_intent_id === intent.id) return 'done';
  if (
    move.offer_status === 'offered' &&
    move.offer_cents !== null &&
    paymentMatchesCheckout(intent, move.offer_cents, stripeSecretKey)
  )
    return 'accept';
  return 'refund';
}

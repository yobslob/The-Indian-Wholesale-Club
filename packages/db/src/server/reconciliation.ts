/**
 * A paid checkout that could not become an order, recorded once per PaymentIntent (launch QA F-3). The browser, the
 * webhook and the sweep can each reach the same refused order; migration 20261108090300's trigger skips the insert
 * while an unresolved row for the payment exists, and this says whether this call wrote it (so one alert goes out).
 */
import { unwrap, type IwcClient } from '../client';

import type { Json } from '../database.types';

export interface FailedReconciliationInput {
  paymentIntentId: string;
  stripeEventId: string | null;
  amountCents: number | null;
  email: string | null;
  reason: string;
  metadata?: NonNullable<Json>;
}

/** True when this call recorded it; false when an unresolved record for the payment was already there. */
export async function recordFailedReconciliationOnce(
  service: IwcClient,
  input: FailedReconciliationInput,
): Promise<boolean> {
  const rows = unwrap(
    await service
      .from('failed_reconciliations')
      .insert({
        payment_intent_id: input.paymentIntentId,
        stripe_event_id: input.stripeEventId,
        amount_cents: input.amountCents,
        currency: 'usd',
        customer_email: input.email,
        error_reason: input.reason,
        metadata: input.metadata ?? {},
      })
      .select('id'),
  );
  return rows.length > 0;
}

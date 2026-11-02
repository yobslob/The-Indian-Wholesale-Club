import 'server-only';

import { savePendingCheckout } from '@repo/db/server';

import { errorMessage, logger } from '@/lib/logger';

import { canReuseIntent, intentIdFromSecret } from './intent-key';

import type { PendingCheckout } from './finalize';
import type { IwcClient } from '@repo/db';
import type Stripe from 'stripe';

/**
 * One PaymentIntent per checkout visit (launch QA A-5): a re-price (shipping switched, details edited) moves the
 * amount of the payment the browser already holds instead of creating another one, so the card form keeps what was
 * typed. The stored checkout (pending_orders) always matches the payment's amount: if storing it fails, the amount
 * is put back, or the payment is cancelled so nothing can be paid against a checkout we did not keep (D-038).
 */
async function reusable(
  stripe: Stripe,
  secret: string | null,
): Promise<Stripe.PaymentIntent | null> {
  const id = secret ? intentIdFromSecret(secret) : null;
  if (!secret || !id) return null;
  try {
    const intent = await stripe.paymentIntents.retrieve(id);
    return canReuseIntent(intent, secret) ? intent : null;
  } catch (error) {
    logger.warn('checkout.intent_not_reusable', { error: errorMessage(error) });
    return null;
  }
}

async function create(
  stripe: Stripe,
  amount: number,
  email: string,
  idempotencyKey: string,
): Promise<Stripe.PaymentIntent> {
  const params: Stripe.PaymentIntentCreateParams = {
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    receipt_email: email,
    metadata: { source: 'iwc' },
  };
  const intent = await stripe.paymentIntents.create(params, { idempotencyKey });
  if (intent.lastResponse.headers['idempotent-replayed'] !== 'true') return intent;
  // A replay returns the payment as it was created: make sure it is still unpaid, else start a new one.
  const fresh = await stripe.paymentIntents.retrieve(intent.id);
  if (fresh.status === 'requires_payment_method') return fresh;
  return stripe.paymentIntents.create(params, { idempotencyKey: `${idempotencyKey}-again` });
}

export async function startPayment(
  stripe: Stripe,
  service: IwcClient,
  input: { pending: PendingCheckout; reuseSecret: string | null; idempotencyKey: string },
): Promise<Stripe.PaymentIntent> {
  const { pending } = input;
  const held = await reusable(stripe, input.reuseSecret);
  let intent: Stripe.PaymentIntent;
  if (held && held.amount === pending.totalCents && held.receipt_email === pending.email)
    intent = held;
  else if (held)
    intent = await stripe.paymentIntents.update(held.id, {
      amount: pending.totalCents,
      receipt_email: pending.email,
    });
  else intent = await create(stripe, pending.totalCents, pending.email, input.idempotencyKey);

  try {
    await savePendingCheckout(service, intent.id, { ...pending });
  } catch (error) {
    // A reused payment whose amount did not move still matches the checkout stored before: nothing to undo.
    if (!held) await undo(stripe, intent.id, null);
    else if (held.amount !== intent.amount) await undo(stripe, intent.id, held.amount);
    throw error;
  }
  return intent;
}

/** The checkout could not be stored: put a reused payment's amount back (its old checkout is still stored), else cancel. */
async function undo(stripe: Stripe, id: string, previousAmount: number | null): Promise<void> {
  if (previousAmount !== null) {
    const restored = await stripe.paymentIntents
      .update(id, { amount: previousAmount })
      .then(() => true)
      .catch(() => false);
    if (restored) return;
  }
  await stripe.paymentIntents
    .cancel(id)
    .catch((error: unknown) =>
      logger.error('checkout.intent_cancel_failed', {
        paymentIntentId: id,
        error: errorMessage(error),
      }),
    );
}

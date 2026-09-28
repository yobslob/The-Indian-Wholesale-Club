import 'server-only';

import { z } from 'zod';

import { DbError, type IwcClient } from '@repo/db';
import {
  createOrder,
  enqueueEmail,
  findOrderByPaymentIntent,
  getPendingCheckout,
  markPendingReconciled,
  recordFailedReconciliation,
  redeemPromo,
} from '@repo/db/server';

import { deliverOutboxRow } from '@/lib/email/send';
import { errorMessage, logger } from '@/lib/logger';
import { stripeServer } from '@/lib/stripe';

/** What the checkout route stored with the PaymentIntent (pending_orders.checkout_payload). */
export const pendingCheckoutSchema = z.object({
  email: z.string().email(),
  userId: z.string().uuid().nullable(),
  shippingAddress: z.record(z.string(), z.union([z.string(), z.null()])),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int(),
      }),
    )
    .min(1),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  shippingCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  promoCodeId: z.string().uuid().nullable(),
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
});
export type PendingCheckout = z.infer<typeof pendingCheckoutSchema>;

export type FinalizeResult =
  | { ok: true; orderNumber: string }
  | {
      ok: false;
      reason: 'payment_not_complete' | 'unknown_payment' | 'payment_mismatch' | 'order_refused';
      detail?: string;
    };

/**
 * flows.md §3 steps 3–5. Creates the order for a PaymentIntent, once, from the
 * payload stored at checkout (never from the browser). Called by the browser
 * after payment and by the Stripe webhook; whichever comes second finds the
 * existing order. If the database refuses (sold out meanwhile, price changed,
 * no open cycle) the payment is refunded in full.
 */
export async function finalizeOrder(
  service: IwcClient,
  paymentIntentId: string,
  via: 'browser' | 'webhook',
  stripeEventId: string | null = null,
): Promise<FinalizeResult> {
  const existing = await findOrderByPaymentIntent(service, paymentIntentId);
  if (existing) return { ok: true, orderNumber: existing.order_number };

  const pending = await getPendingCheckout(service, paymentIntentId);
  const parsed = pending ? pendingCheckoutSchema.safeParse(pending.checkout_payload) : null;
  if (!parsed?.success) {
    if (via === 'webhook') {
      await recordFailedReconciliation(service, {
        paymentIntentId,
        stripeEventId,
        amountCents: null,
        email: null,
        reason: pending
          ? 'Stored checkout payload is invalid'
          : 'No stored checkout for this payment',
      });
    }
    return { ok: false, reason: 'unknown_payment' };
  }
  const input = parsed.data;

  const stripe = stripeServer();
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (intent.status !== 'succeeded')
    return { ok: false, reason: 'payment_not_complete', detail: intent.status };
  const mismatch =
    intent.amount !== input.totalCents ||
    intent.currency.toLowerCase() !== 'usd' ||
    (process.env.NODE_ENV === 'production' && !intent.livemode);
  if (mismatch) {
    await recordFailedReconciliation(service, {
      paymentIntentId,
      stripeEventId,
      amountCents: intent.amount,
      email: input.email,
      reason: 'PaymentIntent does not match the stored checkout (amount, currency or mode)',
    });
    return { ok: false, reason: 'payment_mismatch' };
  }

  let result;
  try {
    result = await createOrder(service, { ...input, paymentIntentId });
  } catch (error) {
    // The browser and the webhook raced: payment_intent_id is unique, so one insert lost.
    if (error instanceof DbError && error.code === '23505') {
      const order = await findOrderByPaymentIntent(service, paymentIntentId);
      if (order) return { ok: true, orderNumber: order.order_number };
    }
    throw error;
  }

  if (!result.ok) {
    await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-${paymentIntentId}` },
    );
    await recordFailedReconciliation(service, {
      paymentIntentId,
      stripeEventId,
      amountCents: intent.amount,
      email: input.email,
      reason: `Order refused (${result.reason}); payment refunded`,
      metadata: { reason: result.reason, detail: result.detail },
    });
    logger.warn('checkout.order_refused_refunded', { paymentIntentId, reason: result.reason });
    return { ok: false, reason: 'order_refused', detail: result.reason };
  }

  await markPendingReconciled(service, paymentIntentId, via);
  if (input.promoCodeId && !(await redeemPromo(service, input.promoCodeId))) {
    // The code hit its limit between pricing and payment. The customer keeps the discount they paid for.
    logger.warn('checkout.promo_limit_reached_after_payment', { orderNumber: result.orderNumber });
  }
  try {
    const outboxId = await enqueueEmail(service, 'order_confirmation', input.email, {
      orderNumber: result.orderNumber,
    });
    void deliverOutboxRow(service, {
      id: outboxId,
      kind: 'order_confirmation',
      recipient: input.email,
      payload: { orderNumber: result.orderNumber },
      attempts: 0,
    });
  } catch (error) {
    logger.error('email.enqueue_failed', {
      orderNumber: result.orderNumber,
      error: errorMessage(error),
    });
  }
  return { ok: true, orderNumber: result.orderNumber };
}

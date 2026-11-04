import 'server-only';

import { z } from 'zod';

import { DbError, type IwcClient } from '@repo/db';
import {
  createOrder,
  enqueueEmail,
  findOrderByPaymentIntent,
  getPendingCheckout,
  markPendingReconciled,
  recordFailedReconciliationOnce,
  redeemPromo,
  rememberOrderAddress,
} from '@repo/db/server';
import { shippingAddressSchema } from '@repo/shared/domain';

import { revalidateAfterSale } from '@/features/catalog/revalidate';
import { alertDollars, sendAlert } from '@/lib/alert';
import { deliverOutboxRow } from '@/lib/email/send';
import { errorMessage, logger } from '@/lib/logger';
import { stripeServer } from '@/lib/stripe';

import { paymentMatchesCheckout } from './payment-check';

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
  /** D-111: the part of shippingCents that is retailer charges (absent before 2026-10-12). */
  retailerChargeCents: z.number().int().min(0).default(0),
  /** D-119: the part of discountCents that is the bulk saving (absent before 2026-10-14). */
  bulkSavingCents: z.number().int().min(0).default(0),
  /** Heavy-item shipping: the part of shippingCents that is the heavy pieces' charge (absent before 2026-10-24). */
  heavyShippingCents: z.number().int().min(0).default(0),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  promoCodeId: z.string().uuid().nullable(),
  // A checkout stored before D-187 may say express; create_order keeps it (old orders keep their word, Y-1).
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
  /** The product pages to refresh after the sale; absent in checkouts stored before 2026-10-06. */
  pages: z.array(z.object({ regionSlug: z.string().nullable(), productSlug: z.string() })).default([]),
});
export type PendingCheckout = z.infer<typeof pendingCheckoutSchema>;

type FailedReconciliation = Parameters<typeof recordFailedReconciliationOnce>[1];

/**
 * F-3: recorded once per payment (the browser, the webhook and the sweep can each reach the same refusal), and the
 * founder is alerted the first time. The alert carries the payment, amount and reason, never the customer's email.
 */
async function recordFailedReconciliation(service: IwcClient, input: FailedReconciliation): Promise<void> {
  const isNew = await recordFailedReconciliationOnce(service, input);
  if (!isNew) return;
  await sendAlert('Paid, but no order: check it in Stripe', {
    paymentIntentId: input.paymentIntentId,
    amount: input.amountCents === null ? 'unknown' : alertDollars(input.amountCents),
    reason: input.reason,
  });
}

/** F-6: the order number on the payment, so support finds an order from Stripe. Best effort: never fails the order. */
async function tagPayment(paymentIntentId: string, orderNumber: string): Promise<void> {
  await stripeServer()
    .paymentIntents.update(paymentIntentId, { metadata: { order_number: orderNumber } })
    .catch((error: unknown) =>
      logger.warn('checkout.payment_not_tagged', { orderNumber, error: errorMessage(error) }),
    );
}

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
 * existing order. If the database refuses (sold out meanwhile, price changed)
 * the payment is refunded in full.
 */
export async function finalizeOrder(
  service: IwcClient,
  paymentIntentId: string,
  via: 'browser' | 'webhook' | 'sweep',
  stripeEventId: string | null = null,
): Promise<FinalizeResult> {
  // Both reads at once: the second caller (browser or webhook) usually finds the order; the first needs the checkout.
  const [existing, pending] = await Promise.all([
    findOrderByPaymentIntent(service, paymentIntentId),
    getPendingCheckout(service, paymentIntentId),
  ]);
  if (existing) return { ok: true, orderNumber: existing.order_number };

  const parsed = pending ? pendingCheckoutSchema.safeParse(pending.checkout_payload) : null;
  if (!parsed?.success) {
    if (via !== 'browser') {
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
  if (!paymentMatchesCheckout(intent, input.totalCents, process.env.STRIPE_SECRET_KEY ?? '')) {
    await recordFailedReconciliation(service, {
      paymentIntentId,
      stripeEventId,
      amountCents: intent.amount,
      email: input.email,
      reason: 'PaymentIntent does not match the stored checkout (amount, currency or mode)',
    });
    return { ok: false, reason: 'payment_mismatch' };
  }

  const { pages, ...order } = input;
  let result;
  try {
    result = await createOrder(service, { ...order, paymentIntentId });
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

  // The pieces are reserved: the pages showing their stock are rebuilt on their next visit (§Caching).
  revalidateAfterSale(pages);
  const [, promoRedeemed] = await Promise.all([
    markPendingReconciled(service, paymentIntentId, via),
    input.promoCodeId ? redeemPromo(service, input.promoCodeId) : Promise.resolve(true),
    tagPayment(paymentIntentId, result.orderNumber),
  ]);
  if (!promoRedeemed) {
    // The code hit its limit between pricing and payment. The customer keeps the discount they paid for.
    logger.warn('checkout.promo_limit_reached_after_payment', { orderNumber: result.orderNumber });
  }
  // D-114: a signed-in customer's address is kept for their next checkout. Never fails the order.
  const address = shippingAddressSchema.safeParse(input.shippingAddress);
  if (input.userId && address.success) {
    await rememberOrderAddress(service, input.userId, address.data).catch((error: unknown) =>
      logger.warn('checkout.address_not_saved', { orderNumber: result.orderNumber, error: errorMessage(error) }),
    );
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

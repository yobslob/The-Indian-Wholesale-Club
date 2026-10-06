/**
 * Checkout reads + the operational tables around payment (service role only).
 * flows.md §3. Import from '@repo/db/server' in server code only.
 */
import { z } from 'zod';

import { DbError, unwrap, type IwcClient } from '../client';
import { deliveryWindowSchema } from '../store/schemas';

import type { Json } from '../database.types';

export const checkoutVariantSchema = z.object({
  variant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_slug: z.string(),
  product_type: z.enum(['clothing', 'spice']),
  region_slug: z.string(),
  region_name: z.string(),
  label: z.string(),
  price_cents: z.number().int(),
  available: z.number().int(),
  image_path: z.string().nullable(),
  /** D-073: taxed or exempt depends on the delivery state's rule for this class. */
  tax_class: z.enum(['clothing', 'food', 'general']),
  /** D-070: what the courier charges to carry one piece (express). Never the weight (INV-1). */
  courier_cents: z.number().int(),
});

export const checkoutPromoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().int(),
  min_order_cents: z.number().int(),
});

export const checkoutContextSchema = z.object({
  variants: z.array(checkoutVariantSchema),
  promo: checkoutPromoSchema.nullable(),
  shipping: z.object({
    flat_cents: z.number().int().nullable(),
    free_min_cents: z.number().int().nullable(),
  }),
  delivery: deliveryWindowSchema.nullable(),
  /** D-073: the delivery state's rule, or null where IWC is not registered (no tax). */
  tax: z
    .object({
      state: z.string(),
      rate_pct: z.coerce.number(),
      taxes_clothing: z.boolean(),
      taxes_food: z.boolean(),
      taxes_general: z.boolean(),
    })
    .nullable(),
  /** D-072: a bag of only pieces already in the US: today + the US delivery days (null otherwise). */
  us_delivery: z.object({ est_delivery_from: z.string(), est_delivery_to: z.string() }).nullable().default(null),
  /** D-070: courier from Mumbai to the door, priced per order + per piece; its window counts from today. Never for a
   * bag with a piece already in the US. */
  express: z
    .object({
      base_cents: z.number().int(),
      min_courier_cents: z.number().int(),
      est_delivery_from: z.string(),
      est_delivery_to: z.string(),
    })
    .nullable(),
});

export type CheckoutVariant = z.infer<typeof checkoutVariantSchema>;
export type CheckoutPromo = z.infer<typeof checkoutPromoSchema>;
export type CheckoutContext = z.infer<typeof checkoutContextSchema>;

/** Everything needed to price a cart, in one round trip (migration 3, PR-2). */
export async function getCheckoutContext(
  service: IwcClient,
  variantIds: string[],
  promoCode: string | null,
  state: string | null = null,
): Promise<CheckoutContext> {
  const data = unwrap(
    await service.rpc('checkout_context', {
      p_variant_ids: variantIds,
      ...(promoCode ? { p_promo_code: promoCode } : {}),
      ...(state ? { p_state: state } : {}),
    }),
  );
  return checkoutContextSchema.parse(data);
}

// ---------------------------------------------------------------- pending checkouts (webhook reconciliation)

/** Stored when the PaymentIntent is created; the order is later created from THIS, never from the browser. */
export async function savePendingCheckout(
  service: IwcClient,
  paymentIntentId: string,
  payload: NonNullable<Json>,
) {
  unwrap(
    await service
      .from('pending_orders')
      .upsert(
        { payment_intent_id: paymentIntentId, checkout_payload: payload },
        { onConflict: 'payment_intent_id' },
      ),
  );
}

export async function getPendingCheckout(service: IwcClient, paymentIntentId: string) {
  return unwrap(
    await service
      .from('pending_orders')
      .select('payment_intent_id, checkout_payload, reconciled_at')
      .eq('payment_intent_id', paymentIntentId)
      .maybeSingle(),
  );
}

export async function markPendingReconciled(
  service: IwcClient,
  paymentIntentId: string,
  by: 'browser' | 'webhook',
) {
  unwrap(
    await service
      .from('pending_orders')
      .update({ reconciled_at: new Date().toISOString(), reconciled_by: by })
      .eq('payment_intent_id', paymentIntentId)
      .is('reconciled_at', null),
  );
}

export async function recordFailedReconciliation(
  service: IwcClient,
  input: {
    paymentIntentId: string;
    stripeEventId: string | null;
    amountCents: number | null;
    email: string | null;
    reason: string;
    metadata?: NonNullable<Json>;
  },
) {
  unwrap(
    await service.from('failed_reconciliations').insert({
      payment_intent_id: input.paymentIntentId,
      stripe_event_id: input.stripeEventId,
      amount_cents: input.amountCents,
      currency: 'usd',
      customer_email: input.email,
      error_reason: input.reason,
      metadata: input.metadata ?? {},
    }),
  );
}

/** The order already created for a PaymentIntent (idempotency: one payment pays for one order). */
export async function findOrderByPaymentIntent(service: IwcClient, paymentIntentId: string) {
  return unwrap(
    await service
      .from('orders')
      .select('id, order_number, email, total_cents')
      .eq('payment_intent_id', paymentIntentId)
      .maybeSingle(),
  );
}

// ---------------------------------------------------------------- webhooks + email outbox

/** True the first time an event id is seen; false for a duplicate delivery. */
export async function claimWebhookEvent(
  service: IwcClient,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const { error } = await service
    .from('webhook_events')
    .insert({ event_id: eventId, event_type: eventType });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw new DbError(error.code || 'unknown', error.message);
}

/** Lets a failed handler be retried by Stripe (the claim is removed). */
export async function releaseWebhookEvent(service: IwcClient, eventId: string) {
  unwrap(await service.from('webhook_events').delete().eq('event_id', eventId));
}

export type EmailKind = 'order_confirmation';

export async function enqueueEmail(
  service: IwcClient,
  kind: EmailKind,
  recipient: string,
  payload: NonNullable<Json>,
) {
  return unwrap(
    await service.from('email_outbox').insert({ kind, recipient, payload }).select('id').single(),
  ).id;
}

/**
 * Takes a due row for sending (pending, or processing but stale after a crash).
 * Returns false when another run already took it, so one email is never sent twice.
 */
export async function claimEmail(service: IwcClient, id: string): Promise<boolean> {
  const now = new Date();
  const rows = unwrap(
    await service
      .from('email_outbox')
      .update({
        status: 'processing',
        next_attempt_at: new Date(now.getTime() + 10 * 60_000).toISOString(),
      })
      .eq('id', id)
      .in('status', ['pending', 'processing'])
      .lte('next_attempt_at', now.toISOString())
      .select('id'),
  );
  return rows.length === 1;
}

export async function markEmailSent(
  service: IwcClient,
  id: string,
  providerMessageId: string | null,
) {
  unwrap(
    await service
      .from('email_outbox')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: providerMessageId,
      })
      .eq('id', id),
  );
}

/** Exponential backoff; after 5 attempts the row is parked as dead_letter for an admin. */
export async function markEmailFailed(
  service: IwcClient,
  id: string,
  attempts: number,
  error: string,
) {
  const next = attempts + 1;
  unwrap(
    await service
      .from('email_outbox')
      .update({
        status: next >= 5 ? 'dead_letter' : 'pending',
        attempts: next,
        last_error: error.slice(0, 500),
        next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** next) * 60_000).toISOString(),
      })
      .eq('id', id),
  );
}

export async function listDueEmails(service: IwcClient, limit = 20) {
  return unwrap(
    await service
      .from('email_outbox')
      .select('id, kind, recipient, payload, attempts')
      .in('status', ['pending', 'processing'])
      .lte('next_attempt_at', new Date().toISOString())
      .order('next_attempt_at')
      .limit(limit),
  );
}

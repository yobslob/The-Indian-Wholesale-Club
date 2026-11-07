/**
 * Checkout reads + the operational tables around payment (service role only).
 * flows.md §3. Import from '@repo/db/server' in server code only.
 */
import { z } from 'zod';

import { PRODUCT_TYPES } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';
import { deliveryWindowSchema } from '../store/schemas';

import type { Json } from '../database.types';

// The webhook's event claims and the payment sweep (launch QA F-1, F-2).
export * from './payments';

export const checkoutVariantSchema = z.object({
  variant_id: z.string().uuid(),
  product_id: z.string().uuid(),
  product_name: z.string(),
  product_slug: z.string(),
  product_type: z.enum(PRODUCT_TYPES),
  region_slug: z.string().nullable(),
  region_name: z.string().nullable(),
  label: z.string(),
  price_cents: z.number().int(),
  available: z.number().int(),
  image_path: z.string().nullable(),
  /** D-073: taxed or exempt depends on the delivery state's rule for this class. */
  tax_class: z.enum(['clothing', 'food', 'general']),
});

export const checkoutPromoSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().int(),
  min_order_cents: z.number().int(),
  /** D-191: a percentage coupon's most. */
  max_discount_cents: z.number().int().nullable().default(null),
});

/** D-191: a public coupon, for checkout's coupon box. */
export const checkoutCouponSchema = z.object({
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().int(),
  min_order_cents: z.number().int(),
  max_discount_cents: z.number().int().nullable(),
  new_customers_only: z.boolean(),
});

/** §10 Y-3: one asked line's stock, also when it is no longer on sale (name, label and photo null only if it is gone). */
export const checkoutStockSchema = z.object({
  variant_id: z.string().uuid(),
  on_sale: z.boolean(),
  available: z.number().int(),
  product_name: z.string().nullable(),
  label: z.string().nullable(),
  image_path: z.string().nullable(),
});

export const checkoutContextSchema = z.object({
  variants: z.array(checkoutVariantSchema),
  /** Every id asked, in the order asked. */
  stock: z.array(checkoutStockSchema),
  promo: checkoutPromoSchema.nullable(),
  /** D-191: the coupon box's coupons, whether this customer has no paid order yet, and their coins (null: no account). */
  coupons: z.array(checkoutCouponSchema).default([]),
  is_new_customer: z.boolean().default(true),
  coins: z.number().int().nullable().default(null),
  shipping: z.object({
    flat_cents: z.number().int().nullable(),
    free_min_cents: z.number().int().nullable(),
    /** D-187: the bulk saving and the heavy-item discount start here. */
    bulk_saving_from_cents: z.number().int().nullable(),
    /** D-109: smaller bags cannot check out. */
    min_order_cents: z.number().int().nullable().default(null),
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
  /** D-187: the food shipment's window (today + the food delivery days); the bag's charges say whether the bag has one. */
  food_delivery: z.object({ est_delivery_from: z.string(), est_delivery_to: z.string() }).nullable().default(null),
});

export type CheckoutVariant = z.infer<typeof checkoutVariantSchema>;
export type CheckoutPromo = z.infer<typeof checkoutPromoSchema>;
export type CheckoutStock = z.infer<typeof checkoutStockSchema>;
export type CheckoutContext = z.infer<typeof checkoutContextSchema>;

/** Everything needed to price a cart, in one round trip (migration 3, PR-2). `who`: the customer, for coupons and coins. */
export async function getCheckoutContext(
  service: IwcClient,
  variantIds: string[],
  promoCode: string | null,
  state: string | null = null,
  who: { userId?: string | null; email?: string | null } = {},
): Promise<CheckoutContext> {
  const data = unwrap(
    await service.rpc('checkout_context', {
      p_variant_ids: variantIds,
      ...(promoCode ? { p_promo_code: promoCode } : {}),
      ...(state ? { p_state: state } : {}),
      ...(who.userId ? { p_user: who.userId } : {}),
      ...(who.email ? { p_email: who.email } : {}),
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
  by: 'browser' | 'webhook' | 'sweep',
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

// ---------------------------------------------------------------- email outbox

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

// ---------------------------------------------------------------- the address of a paid order (D-114)

/** A paid order's delivery address, as the checkout stored it. */
export interface OrderAddress {
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
}

const same = (a: string | null, b: string | null): boolean =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/**
 * D-114: a signed-in customer's paid order adds its address to their saved addresses, unless the same street, unit and
 * ZIP is already there; their first one becomes the default. Service role (called once, when the order is created).
 */
export async function rememberOrderAddress(service: IwcClient, userId: string, a: OrderAddress): Promise<void> {
  const saved = unwrap(
    await service.from('addresses').select('line1, line2, zip_code, is_default').eq('user_id', userId),
  );
  if (saved.some((s) => same(s.line1, a.line1) && same(s.line2, a.line2) && same(s.zip_code, a.zipCode))) return;
  unwrap(
    await service.from('addresses').insert({
      user_id: userId,
      full_name: a.fullName,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      zip_code: a.zipCode,
      phone: a.phone,
      is_default: !saved.some((s) => s.is_default),
    }),
  );
}

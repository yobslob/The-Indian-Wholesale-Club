/**
 * Server-only operations that need the SERVICE-ROLE client (never shipped to a
 * browser or the app bundle). Import from '@repo/db/server' in server code only.
 */
import { DbError, toDbError, unwrap, type IwcClient } from '../client';
import { orderDetailSchema, type OrderDetail } from '../store/schemas';

import type { Json } from '../database.types';

export * from './checkout';

export interface CreateOrderItemInput {
  variantId: string;
  quantity: number;
  /** The price the customer saw. The DB rejects it if it differs from the catalog. */
  unitPriceCents: number;
}

export interface CreateOrderInput {
  email: string;
  userId: string | null;
  shippingAddress: Record<string, Json>;
  items: CreateOrderItemInput[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  paymentIntentId: string;
  promoCodeId: string | null;
  /** D-041. Express uses the express delivery days for the window. */
  shippingMethod: 'standard' | 'express';
}

/** Business reasons create_order can refuse (docs/data-model.md, business functions). */
export type CreateOrderRefusal =
  | 'no_open_cycle'
  | 'cycle_closed'
  | 'delivery_window_unconfigured'
  | 'express_unavailable'
  | 'order_has_no_items'
  | 'variant_unavailable'
  | 'price_mismatch'
  | 'insufficient_stock'
  | 'subtotal_mismatch';

const REFUSALS: ReadonlySet<string> = new Set<CreateOrderRefusal>([
  'no_open_cycle',
  'cycle_closed',
  'delivery_window_unconfigured',
  'express_unavailable',
  'order_has_no_items',
  'variant_unavailable',
  'price_mismatch',
  'insufficient_stock',
  'subtotal_mismatch',
]);

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; reason: CreateOrderRefusal; detail: string | null };

/**
 * flows.md §3 step 4. Call ONLY after Stripe verified the payment. On a refusal
 * nothing was written; the caller must refund/cancel the PaymentIntent.
 */
export async function createOrder(
  service: IwcClient,
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const payload: Json = {
    email: input.email,
    user_id: input.userId,
    shipping_address: input.shippingAddress,
    items: input.items.map((item) => ({
      variant_id: item.variantId,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
    })),
    subtotal_cents: input.subtotalCents,
    discount_cents: input.discountCents,
    shipping_cents: input.shippingCents,
    tax_cents: input.taxCents,
    total_cents: input.totalCents,
    payment_intent_id: input.paymentIntentId,
    promo_code_id: input.promoCodeId,
    shipping_method: input.shippingMethod,
  };
  const { data, error } = await service.rpc('create_order', { p_order: payload });
  if (error) {
    const dbError = toDbError(error);
    if (REFUSALS.has(dbError.code)) {
      return { ok: false, reason: dbError.code as CreateOrderRefusal, detail: dbError.detail };
    }
    throw dbError;
  }
  const row = Array.isArray(data) ? data[0] : undefined;
  if (!row) throw new DbError('create_order_empty', 'create_order returned no row');
  return { ok: true, orderId: row.order_id, orderNumber: row.order_number };
}

/** /orders/lookup: guest order by number + email; null when they don't match. */
export async function lookupGuestOrder(
  service: IwcClient,
  orderNumber: string,
  email: string,
): Promise<OrderDetail | null> {
  const data = unwrap(
    await service.rpc('guest_order_lookup', { p_order_number: orderNumber, p_email: email }),
  );
  return data === null ? null : orderDetailSchema.parse(data);
}

/** Atomic, limit-checked promo redemption. False = limit reached / expired / inactive. */
export async function redeemPromo(service: IwcClient, promoCodeId: string): Promise<boolean> {
  return unwrap(await service.rpc('increment_promo_uses', { p_promo: promoCodeId })) === true;
}

// ---------------------------------------------------------------- the faster-delivery offer (D-064)

/** The open offer on an order (service role): the move it belongs to and its price. Null when there is none. */
export async function getOpenOffer(service: IwcClient, orderId: string) {
  return unwrap(
    await service
      .from('order_moves')
      .select('id, offer_cents, offer_from, offer_to')
      .eq('order_id', orderId)
      .eq('offer_status', 'offered')
      .order('moved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

/** Call ONLY after Stripe confirmed the payment. Refuses ('offer_not_open') when it lapsed meanwhile: refund then. */
export async function acceptFastOffer(
  service: IwcClient,
  moveId: string,
  paymentIntentId: string,
): Promise<{ ok: true } | { ok: false; reason: 'offer_not_open' }> {
  const { error } = await service.rpc('accept_fast_offer', {
    p_move: moveId,
    p_payment_intent: paymentIntentId,
  });
  if (!error) return { ok: true };
  const dbError = toDbError(error);
  if (dbError.code === 'offer_not_open') return { ok: false, reason: 'offer_not_open' };
  throw dbError;
}

/** The order an order number + its email point to (the same proof as the guest lookup). Null when they don't match. */
export async function findOrderIdByNumberAndEmail(
  service: IwcClient,
  orderNumber: string,
  email: string,
): Promise<string | null> {
  const row = unwrap(
    await service
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle(),
  );
  return row?.id ?? null;
}

export async function getOfferMove(service: IwcClient, moveId: string) {
  return unwrap(
    await service
      .from('order_moves')
      .select('id, offer_status, offer_cents, payment_intent_id')
      .eq('id', moveId)
      .maybeSingle(),
  );
}

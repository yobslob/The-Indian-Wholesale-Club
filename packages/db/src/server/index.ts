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
  /** D-111: the part of shippingCents that is a small order's retailer charges. */
  retailerChargeCents?: number;
  /** D-119: the part of discountCents that is the bulk saving. */
  bulkSavingCents?: number;
  /** Heavy-item shipping: the part of shippingCents that is the heavy pieces' charge (founder 2026-10-24). */
  heavyShippingCents?: number;
  taxCents: number;
  totalCents: number;
  paymentIntentId: string;
  promoCodeId: string | null;
  /** Standard only since D-187 (Y-1); a payment already priced with Express when the release lands stays Express. */
  shippingMethod?: 'standard' | 'express';
}

/** Business reasons create_order can refuse (docs/data-model.md, business functions). */
export type CreateOrderRefusal =
  | 'delivery_window_unconfigured'
  | 'order_has_no_items'
  | 'variant_unavailable'
  | 'price_mismatch'
  | 'insufficient_stock'
  | 'subtotal_mismatch';

const REFUSALS: ReadonlySet<string> = new Set<CreateOrderRefusal>([
  'delivery_window_unconfigured',
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
    shipping_method: input.shippingMethod ?? 'standard',
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
  // The splits are for the admin's records only (the total already counts them), so they are written beside the order.
  if (input.retailerChargeCents || input.bulkSavingCents || input.heavyShippingCents) {
    unwrap(
      await service
        .from('orders')
        .update({
          retailer_charge_cents: input.retailerChargeCents ?? 0,
          bulk_saving_cents: input.bulkSavingCents ?? 0,
          heavy_shipping_cents: input.heavyShippingCents ?? 0,
        })
        .eq('id', row.order_id),
    );
  }
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

// ---------------------------------------------------------------- the customer's own choices (D-008, D-042)

/** The order behind a number + email, with what the server needs to refund it. Null when they don't match. */
export async function getOrderForCustomer(service: IwcClient, orderNumber: string, email: string) {
  return unwrap(
    await service
      .from('orders')
      .select('id, order_number, payment_intent_id')
      .eq('order_number', orderNumber)
      .eq('email', email.trim().toLowerCase())
      .maybeSingle(),
  );
}

/** D-008: the customer keeps the order with its new estimate. */
export async function keepAfterDelay(service: IwcClient, orderId: string) {
  unwrap(await service.rpc('keep_after_delay', { p_order: orderId }));
}

/** D-008 / D-042: after a delay, a full refund. Call after the Stripe refund; the database re-checks the amount. */
export async function cancelAfterDelay(
  service: IwcClient,
  input: { orderId: string; amountCents: number; refundRef: string },
) {
  unwrap(
    await service.rpc('cancel_after_delay', {
      p_order: input.orderId,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}

/**
 * D-072: the customer's own cancel until the order leaves India: everything back, minus the cancel fee once its
 * pieces are being collected. Call after the Stripe refund; the database re-checks the amount.
 */
export async function customerCancel(
  service: IwcClient,
  input: { orderId: string; amountCents: number; refundRef: string },
) {
  unwrap(
    await service.rpc('customer_cancel', {
      p_order: input.orderId,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}

export type ReturnReason = 'damaged' | 'wrong' | 'changed_mind';

/**
 * D-071: the customer asks to return a delivered piece. The refund is fixed now by the database's rule; the money
 * goes back once the piece is received. Refuses ('not_returnable') when the piece can't be returned (anymore).
 */
export async function requestReturn(
  service: IwcClient,
  input: { orderId: string; itemId: string; reason: ReturnReason },
): Promise<{ ok: true } | { ok: false; reason: 'not_returnable' }> {
  const { error } = await service.rpc('request_return', {
    p_order: input.orderId,
    p_item: input.itemId,
    p_reason: input.reason,
  });
  if (!error) return { ok: true };
  const dbError = toDbError(error);
  if (dbError.code === 'not_returnable' || dbError.code === 'item_not_in_order') {
    return { ok: false, reason: 'not_returnable' };
  }
  throw dbError;
}
export * from './reconciliation';
export * from './stripe-events';

import 'server-only';

import { z } from 'zod';

import { getCheckoutContext } from '@repo/db/server';
import {
  emailSchema,
  quoteCheckout,
  shippingAddressSchema,
  type ShippingAddress,
} from '@repo/shared/domain';

import { MAX_QTY_PER_LINE } from '@/features/cart/limits';

import type { CheckoutProblem, CheckoutQuote } from './types';
import type { IwcClient } from '@repo/db';

export const checkoutRequestSchema = z.object({
  email: emailSchema,
  address: shippingAddressSchema,
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
      }),
    )
    .min(1)
    .max(50),
  promoCode: z.string().trim().max(40).nullish(),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export type PriceResult =
  | { ok: true; quote: CheckoutQuote; promoCodeId: string | null; address: ShippingAddress }
  | { ok: false; problem: CheckoutProblem };

/**
 * flows.md §3 steps 1–2: prices the cart from the catalog (never from the
 * browser), applies the promo, shipping (Q-16) and the 8% tax estimate (D-033),
 * and attaches the delivery window shown before payment (D-008). One DB round trip.
 */
export async function priceCart(
  service: IwcClient,
  request: CheckoutRequest,
): Promise<PriceResult> {
  const quantities = new Map<string, number>();
  for (const line of request.lines) {
    quantities.set(
      line.variantId,
      Math.min((quantities.get(line.variantId) ?? 0) + line.quantity, MAX_QTY_PER_LINE),
    );
  }
  const ids = [...quantities.keys()];
  const context = await getCheckoutContext(service, ids, request.promoCode ?? null);
  const byId = new Map(context.variants.map((v) => [v.variant_id, v]));

  const unavailable = ids.filter((id) => !byId.has(id));
  if (unavailable.length > 0)
    return { ok: false, problem: { kind: 'unavailable', variantIds: unavailable } };
  const soldOut = ids.filter((id) => (byId.get(id)?.available ?? 0) < (quantities.get(id) ?? 0));
  if (soldOut.length > 0) return { ok: false, problem: { kind: 'sold_out', variantIds: soldOut } };
  // No open cycle or domestic days unset: no honest delivery window, so no checkout (D-008).
  if (!context.delivery) return { ok: false, problem: { kind: 'closed' } };

  const lines = ids.map((id) => {
    const v = byId.get(id)!;
    const quantity = quantities.get(id)!;
    return {
      variantId: id,
      productName: v.product_name,
      variantLabel: v.label,
      regionName: v.region_name,
      quantity,
      unitPriceCents: v.price_cents,
      totalCents: v.price_cents * quantity,
    };
  });

  const promo = context.promo;
  const breakdown = quoteCheckout(
    lines,
    promo
      ? {
          discountType: promo.discount_type,
          discountValue: promo.discount_value,
          minOrderCents: promo.min_order_cents,
        }
      : null,
    { flatCents: context.shipping.flat_cents, freeMinCents: context.shipping.free_min_cents },
  );
  // TODO(founder): Q-16. Until shipping is decided, checkout stays closed rather than guessing a fee.
  if (!breakdown) return { ok: false, problem: { kind: 'closed' } };

  const entered = request.promoCode?.trim() ? request.promoCode.trim().toUpperCase() : null;
  return {
    ok: true,
    promoCodeId: promo && breakdown.promoApplied ? promo.id : null,
    address: request.address,
    quote: {
      lines,
      breakdown,
      delivery: context.delivery,
      promoCode: promo && breakdown.promoApplied ? promo.code : null,
      promoRejected: entered !== null && !(promo && breakdown.promoApplied),
    },
  };
}

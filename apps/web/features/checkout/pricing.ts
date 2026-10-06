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
import type { ProductPageRef } from '@/features/catalog/revalidate';
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
  shippingMethod: z.enum(['standard', 'express']).default('standard'),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export type PriceResult =
  | {
      ok: true;
      quote: CheckoutQuote;
      promoCodeId: string | null;
      address: ShippingAddress;
      /** The product pages whose stock this order will move (refreshed after the sale, revalidate.ts). */
      pages: ProductPageRef[];
    }
  | { ok: false; problem: CheckoutProblem };

/**
 * flows.md §3 steps 1–2: prices the cart from the catalog (never from the
 * browser), applies the promo, the chosen shipping option (D-041) and the 8% tax
 * estimate (D-033), and attaches the delivery window shown before payment (D-008).
 * One DB round trip.
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
  const quotePromo = promo
    ? {
        discountType: promo.discount_type,
        discountValue: promo.discount_value,
        minOrderCents: promo.min_order_cents,
      }
    : null;
  // D-041: standard is free, express is $8 (both are settings). Express needs its days (Q-18).
  const shipping = {
    flatCents: context.shipping.flat_cents,
    freeMinCents: context.shipping.free_min_cents,
    expressCents: context.express?.price_cents ?? null,
  };
  const standard = quoteCheckout(lines, quotePromo, shipping, 'standard');
  const express = context.express ? quoteCheckout(lines, quotePromo, shipping, 'express') : null;
  const method = request.shippingMethod;
  if (method === 'express' && (!express || !context.express)) {
    return { ok: false, problem: { kind: 'express_unavailable' } };
  }
  const breakdown = method === 'express' ? express : standard;
  // No price for standard shipping yet: checkout stays closed rather than guessing a fee.
  if (!breakdown || !standard) return { ok: false, problem: { kind: 'closed' } };

  const expressWindow = context.express
    ? {
        est_delivery_from: context.express.est_delivery_from,
        est_delivery_to: context.express.est_delivery_to,
        order_by: context.delivery.order_by,
      }
    : null;
  const entered = request.promoCode?.trim() ? request.promoCode.trim().toUpperCase() : null;
  return {
    ok: true,
    promoCodeId: promo && breakdown.promoApplied ? promo.id : null,
    address: request.address,
    pages: [...new Map(context.variants.map((v) => [v.product_id, v])).values()].map((v) => ({
      regionSlug: v.region_slug,
      productSlug: v.product_slug,
    })),
    quote: {
      lines,
      breakdown,
      shippingMethod: method,
      delivery: method === 'express' && expressWindow ? expressWindow : context.delivery,
      options: {
        standard: { shippingCents: standard.shippingCents, delivery: context.delivery },
        express:
          express && expressWindow
            ? { shippingCents: express.shippingCents, delivery: expressWindow }
            : null,
      },
      promoCode: promo && breakdown.promoApplied ? promo.code : null,
      promoRejected: entered !== null && !(promo && breakdown.promoApplied),
    },
  };
}

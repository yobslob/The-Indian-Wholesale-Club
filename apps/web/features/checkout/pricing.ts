import 'server-only';

import { z } from 'zod';

import { getCheckoutContext } from '@repo/db/server';
import { getBagCharges, heavyOf, smallOrderOf } from '@repo/db/store';
import {
  emailSchema,
  promoDiscountCents,
  quoteCheckout,
  shippingAddressSchema,
  type ShippingAddress,
} from '@repo/shared/domain';

import { MAX_QTY_PER_LINE } from '@/features/cart/limits';

import { stockProblems } from './stock';

import type { CheckoutProblem, CheckoutQuote } from './types';
import type { ProductPageRef } from '@/features/catalog/revalidate';
import type { IwcClient } from '@repo/db';
import type { QuotedShipment } from '@repo/shared/domain';

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
  // TODO(D-187): drop when app <next version> is the minimum: the old app sends it; standard is the only shipping (Y-1)
  shippingMethod: z.enum(['standard', 'express']).optional(),
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
 * flows.md §3 steps 1–2: prices the cart from the catalog (never from the browser), applies the promo and the delivery
 * state's sales tax (D-073), and attaches the delivery window shown before payment (D-008). A line that cannot go ahead
 * comes back line by line and no payment starts (§10 Y-3). Two DB round trips (the context, the bag's charges).
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
  const context = await getCheckoutContext(
    service,
    ids,
    request.promoCode ?? null,
    request.address.state,
  );
  const byId = new Map(context.variants.map((v) => [v.variant_id, v]));

  const stock = stockProblems(context, quantities);
  if (stock.length > 0) return { ok: false, problem: { kind: 'stock', lines: stock } };
  // Delivery days unset: no honest delivery window, so no checkout (D-008).
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

  // D-073: taxed only where IWC is registered, and only the classes that state taxes.
  const tax = context.tax;
  const taxed = (cls: 'clothing' | 'food' | 'general'): boolean =>
    Boolean(
      tax &&
      (cls === 'clothing'
        ? tax.taxes_clothing
        : cls === 'food'
          ? tax.taxes_food
          : tax.taxes_general),
    );
  const quoteLines = lines.map((l) => {
    const v = byId.get(l.variantId)!;
    return { ...l, taxable: taxed(v.tax_class) };
  });
  const quoteTax = tax ? { ratePct: tax.rate_pct } : null;

  const promo = context.promo;
  const quotePromo = promo
    ? {
        discountType: promo.discount_type,
        discountValue: promo.discount_value,
        minOrderCents: promo.min_order_cents,
      }
    : null;
  // D-154: the address decides whether the food travels apart, so the bag's charges and shipments are asked for once
  // it is known (one more round trip, at checkout only).
  const subtotal = lines.reduce((n, l) => n + l.totalCents, 0);
  const charges = await getBagCharges(
    service,
    ids.map((variantId) => ({ variantId, quantity: quantities.get(variantId)! })),
    {
      discountCents: promoDiscountCents(subtotal, quotePromo),
      state: request.address.state,
      line1: request.address.line1,
    },
  );
  const shipments = charges.shipments ?? null;
  // D-041: standard is free (a setting). D-111: below the free-shipping line a parcel pays its own shipping and the
  // retailer charges. D-187: the bulk saving and the heavy-item discount start at their own line, not at the free one.
  const shipping = {
    flatCents: context.shipping.flat_cents,
    freeMinCents: context.shipping.free_min_cents,
    bulkFromCents: context.shipping.bulk_saving_from_cents,
    // D-123: the retailer % and the bag's food weight travel with them (bagChargesAt, on the discounted goods)
    smallOrder: smallOrderOf(charges),
    heavy: heavyOf(charges),
    // D-119: the bulk saving (worked out on the discounted subtotal, never from the browser).
    bulkSaving: { pct: charges.bulk_saving_pct, capCents: charges.bulk_saving_cap_cents },
  };
  const breakdown = quoteCheckout(quoteLines, quotePromo, shipping, quoteTax);
  // No price for shipping yet: checkout stays closed rather than guessing a fee.
  if (!breakdown) return { ok: false, problem: { kind: 'closed' } };
  // A smallest order is still a setting (D-109); since D-111 it is unset and small bags pay the charges instead.
  const minOrderCents = context.shipping.min_order_cents;
  if (minOrderCents !== null && breakdown.subtotalCents < minOrderCents) {
    return {
      ok: false,
      problem: { kind: 'below_minimum', minOrderCents, subtotalCents: breakdown.subtotalCents },
    };
  }

  // D-072: a bag of only US pieces ships from the warehouse at once. D-187: a bag of only food comes in the food days; a
  // split bag's order window is the standard one (its food shipment's own date is shown with the shipments).
  // create_order works out the same.
  const window =
    (shipments?.food_only ? context.food_delivery : null) ?? context.us_delivery ?? context.delivery;
  // D-154: the shipments the order will have (create_order works them out the same way), each with its pieces
  const dates = charges.dates;
  const foodIds = new Set(charges.food_ids);
  const split: QuotedShipment[] | null =
    shipments?.split && dates?.food_from && dates.food_to
      ? [
          {
            seq: 1,
            kind: 'food',
            delivery: { est_delivery_from: dates.food_from, est_delivery_to: dates.food_to },
            variantIds: ids.filter((id) => foodIds.has(id)),
          },
          {
            seq: 2,
            kind: 'standard',
            delivery: { est_delivery_from: context.delivery.est_delivery_from, est_delivery_to: context.delivery.est_delivery_to },
            variantIds: ids.filter((id) => !foodIds.has(id)),
          },
        ]
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
      // TODO(D-187): drop shippingMethod and options when app <next version> is the minimum: the old app reads both, and
      // destructures options, so express is null, never missing.
      shippingMethod: 'standard',
      delivery: window,
      options: {
        standard: { shippingCents: breakdown.shippingCents + breakdown.retailerCents, delivery: window },
        express: null,
      },
      promoCode: promo && breakdown.promoApplied ? promo.code : null,
      promoRejected: entered !== null && !(promo && breakdown.promoApplied),
      shipments: split,
      outside: shipments?.outside ?? false,
    },
  };
}

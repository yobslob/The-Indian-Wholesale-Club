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
 * browser), applies the promo, the chosen shipping option (D-041, D-070) and the delivery state's sales tax
 * (D-073), and attaches the delivery window shown before payment (D-008).
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
  const context = await getCheckoutContext(
    service,
    ids,
    request.promoCode ?? null,
    request.address.state,
  );
  const byId = new Map(context.variants.map((v) => [v.variant_id, v]));

  const unavailable = ids.filter((id) => !byId.has(id));
  if (unavailable.length > 0)
    return { ok: false, problem: { kind: 'unavailable', variantIds: unavailable } };
  const soldOut = ids.filter((id) => (byId.get(id)?.available ?? 0) < (quantities.get(id) ?? 0));
  if (soldOut.length > 0) return { ok: false, problem: { kind: 'sold_out', variantIds: soldOut } };
  // No open cycle or domestic days unset: no honest delivery window, so no checkout (D-008). Cycles open by
  // themselves (D-045, D-063), so this only happens when the founder pauses selling.
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
    return { ...l, taxable: taxed(v.tax_class), courierCents: v.courier_cents };
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
  // D-154: the 7-day line counts the 7-day pieces after the promo, and the address decides last, so the bag's charges
  // and shipments are asked for once both are known (one more round trip, at checkout only).
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
  // D-154: Express never carries a 7-day shipment (the plan's case 16): a bag with one is offered standard only.
  const expressOffer = shipments?.split || shipments?.quick_only ? null : context.express;
  // D-041: standard is free (a setting). D-070: express is the courier from Mumbai to the door, priced per order +
  // per piece, offered once its settings exist. D-111: below the free-shipping line a standard parcel pays its own
  // shipping and the retailer charges.
  const shipping = {
    flatCents: context.shipping.flat_cents,
    freeMinCents: context.shipping.free_min_cents,
    // D-123: the retailer % and the bag's food weight travel with them (bagChargesAt, on the discounted goods)
    smallOrder: smallOrderOf(charges),
    // Heavy-item shipping (founder 2026-10-24): standard and express alike; the line takes its % off on standard
    heavy: heavyOf(charges),
    // D-119: from the line up, the bulk saving (worked out on the discounted subtotal, never from the browser).
    bulkSaving: { pct: charges.bulk_saving_pct, capCents: charges.bulk_saving_cap_cents },
    express: expressOffer
      ? { baseCents: expressOffer.base_cents, minCourierCents: expressOffer.min_courier_cents }
      : null,
  };
  const standard = quoteCheckout(quoteLines, quotePromo, shipping, 'standard', quoteTax);
  const express = expressOffer
    ? quoteCheckout(quoteLines, quotePromo, shipping, 'express', quoteTax)
    : null;
  const method = request.shippingMethod;
  if (method === 'express' && (!express || !expressOffer)) {
    return { ok: false, problem: { kind: 'express_unavailable' } };
  }
  const breakdown = method === 'express' ? express : standard;
  // No price for standard shipping yet: checkout stays closed rather than guessing a fee.
  if (!breakdown || !standard) return { ok: false, problem: { kind: 'closed' } };
  // A smallest order is still a setting (D-109); since D-111 it is unset and small bags pay the charges instead.
  const minOrderCents = context.shipping.min_order_cents;
  if (minOrderCents !== null && breakdown.subtotalCents < minOrderCents) {
    return {
      ok: false,
      problem: { kind: 'below_minimum', minOrderCents, subtotalCents: breakdown.subtotalCents },
    };
  }

  // D-072: a bag of only US pieces ships from the warehouse at once, so its window is today + the US delivery days.
  // D-154: a bag of only 7-day pieces worth the 7-day line arrives in the 7-day days; a split bag's order window is the
  // normal one (its 7-day shipment's own date is shown with the shipments). create_order works out the same.
  const fastWindow = (shipments?.quick_only ? context.quick_delivery : null) ?? context.us_delivery;
  const standardWindow = fastWindow
    ? { ...fastWindow, order_by: context.delivery.order_by }
    : context.delivery;
  const expressWindow = expressOffer
    ? {
        est_delivery_from: expressOffer.est_delivery_from,
        est_delivery_to: expressOffer.est_delivery_to,
        order_by: context.delivery.order_by,
      }
    : null;
  // D-154: the shipments the order will have (create_order works them out the same way), each with its pieces
  const dates = charges.dates;
  const quickIds = new Set(charges.quick_ids);
  const split =
    method === 'standard' && shipments?.split && dates?.quick_from && dates.quick_to
      ? ([
          {
            seq: 1,
            kind: 'quick',
            delivery: { est_delivery_from: dates.quick_from, est_delivery_to: dates.quick_to },
            variantIds: ids.filter((id) => quickIds.has(id)),
          },
          {
            seq: 2,
            kind: 'standard',
            delivery: { est_delivery_from: context.delivery.est_delivery_from, est_delivery_to: context.delivery.est_delivery_to },
            variantIds: ids.filter((id) => !quickIds.has(id)),
          },
        ] as const)
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
      delivery: method === 'express' && expressWindow ? expressWindow : standardWindow,
      options: {
        standard: {
          shippingCents: standard.shippingCents + standard.retailerCents,
          delivery: standardWindow,
        },
        express:
          express && expressWindow
            ? { shippingCents: express.shippingCents, delivery: expressWindow }
            : null,
      },
      promoCode: promo && breakdown.promoApplied ? promo.code : null,
      promoRejected: entered !== null && !(promo && breakdown.promoApplied),
      shipments: split ? split.map((sh) => ({ ...sh, variantIds: [...sh.variantIds] })) : null,
      quickGapCents: shipments?.gap_cents ?? null,
      quickBy: dates?.quick_to ?? null,
      quickOutside: shipments?.outside ?? false,
    },
  };
}

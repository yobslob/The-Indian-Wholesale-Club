/**
 * Checkout totals (flows.md §3 step 1). Pure: the server feeds it catalog
 * prices, the promo and the shipping settings from one DB read, and the same
 * numbers go to Stripe and to create_order (which re-checks the subtotal).
 */

export interface QuoteLine {
  unitPriceCents: number;
  quantity: number;
  /** Taxable in the delivery state (D-073: its tax class is taxed there). Default false. */
  taxable?: boolean;
  /** What the courier charges to carry one piece (express, D-070). Default 0. */
  courierCents?: number;
}

export interface QuotePromo {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderCents: number;
}

/** Standard (the cycle, free, D-041) or express (courier from Mumbai to the door, D-070). */
export type ShippingMethod = 'standard' | 'express';

/** From pricing_settings. NULL = not decided: that option can't be quoted. */
export interface ShippingSettings {
  /** Standard shipping per order (D-041: 0 = free). */
  flatCents: number | null;
  /** Standard ships free from this discounted subtotal (NULL = no threshold). */
  freeMinCents: number | null;
  /** Express: per order + the pieces' courier costs, at least the minimum (D-070). Null = no express. */
  express: { baseCents: number; minCourierCents: number } | null;
}

/** Sales tax in the delivery state (D-073); null where IWC is not registered (no tax). */
export interface QuoteTax {
  ratePct: number;
}

export interface CheckoutBreakdown {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  promoApplied: boolean;
}

function assertCents(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative integer`);
}

/** Express fee for these lines: per order + the courier for every piece, never below its minimum (D-070). */
export function expressFeeCents(
  lines: readonly QuoteLine[],
  express: { baseCents: number; minCourierCents: number },
): number {
  const courier = lines.reduce((n, l) => n + (l.courierCents ?? 0) * l.quantity, 0);
  return express.baseCents + Math.max(express.minCourierCents, courier);
}

/**
 * Returns null when the chosen shipping option has no price set: checkout must
 * refuse rather than guess a fee. Throws on impossible input. Tax (D-073) is the delivery state's rate on the taxable
 * lines' share of (subtotal - discount + shipping); none where IWC is not registered.
 */
export function quoteCheckout(
  lines: readonly QuoteLine[],
  promo: QuotePromo | null,
  shipping: ShippingSettings,
  method: ShippingMethod = 'standard',
  tax: QuoteTax | null = null,
): CheckoutBreakdown | null {
  if (lines.length === 0) throw new RangeError('A quote needs at least one line');
  let subtotalCents = 0;
  let taxableCents = 0;
  for (const line of lines) {
    assertCents(line.unitPriceCents, 'unitPriceCents');
    if (!Number.isInteger(line.quantity) || line.quantity < 1)
      throw new RangeError('quantity must be >= 1');
    subtotalCents += line.unitPriceCents * line.quantity;
    if (line.taxable) taxableCents += line.unitPriceCents * line.quantity;
  }

  const price =
    method === 'express'
      ? shipping.express
        ? expressFeeCents(lines, shipping.express)
        : null
      : shipping.flatCents;
  if (price === null) return null;
  assertCents(price, method === 'express' ? 'express fee' : 'flatCents');
  if (shipping.freeMinCents !== null) assertCents(shipping.freeMinCents, 'freeMinCents');

  let discountCents = 0;
  const promoApplied = promo !== null && subtotalCents >= promo.minOrderCents;
  if (promo && promoApplied) {
    assertCents(promo.discountValue, 'discountValue');
    discountCents =
      promo.discountType === 'percentage'
        ? Math.round((subtotalCents * Math.min(promo.discountValue, 100)) / 100)
        : Math.min(promo.discountValue, subtotalCents);
  }

  const discounted = subtotalCents - discountCents;
  const freeShipping =
    method === 'standard' && shipping.freeMinCents !== null && discounted >= shipping.freeMinCents;
  const shippingCents = freeShipping ? 0 : price;
  const taxableShare = subtotalCents === 0 ? 0 : taxableCents / subtotalCents;
  const taxCents = tax ? Math.round(((discounted + shippingCents) * taxableShare * tax.ratePct) / 100) : 0;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: discounted + shippingCents + taxCents,
    promoApplied,
  };
}

/** "$12.50" from cents. */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

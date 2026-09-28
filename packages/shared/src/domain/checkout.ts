/**
 * Checkout totals (flows.md §3 step 1). Pure: the server feeds it catalog
 * prices, the promo and the shipping settings from one DB read, and the same
 * numbers go to Stripe and to create_order (which re-checks the subtotal).
 */

/** D-033: flat 8% sales-tax estimate, applied to (subtotal − discount + shipping). */
export const ESTIMATED_TAX_PCT = 8;

export interface QuoteLine {
  unitPriceCents: number;
  quantity: number;
}

export interface QuotePromo {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderCents: number;
}

/** From pricing_settings. Both NULL until the founder answers Q-16. */
export interface ShippingSettings {
  flatCents: number | null;
  freeMinCents: number | null;
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

/**
 * Returns null when shipping is not configured yet (Q-16): checkout must refuse
 * rather than guess a fee. Throws on impossible input.
 */
export function quoteCheckout(
  lines: readonly QuoteLine[],
  promo: QuotePromo | null,
  shipping: ShippingSettings,
): CheckoutBreakdown | null {
  if (lines.length === 0) throw new RangeError('A quote needs at least one line');
  let subtotalCents = 0;
  for (const line of lines) {
    assertCents(line.unitPriceCents, 'unitPriceCents');
    if (!Number.isInteger(line.quantity) || line.quantity < 1)
      throw new RangeError('quantity must be ≥ 1');
    subtotalCents += line.unitPriceCents * line.quantity;
  }

  if (shipping.flatCents === null) return null;
  assertCents(shipping.flatCents, 'flatCents');
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
  const freeShipping = shipping.freeMinCents !== null && discounted >= shipping.freeMinCents;
  const shippingCents = freeShipping ? 0 : shipping.flatCents;
  const taxCents = Math.round(((discounted + shippingCents) * ESTIMATED_TAX_PCT) / 100);

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

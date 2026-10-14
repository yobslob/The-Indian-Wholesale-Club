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
  /**
   * D-111: below `freeMinCents`, a standard parcel pays these (store_bag_charges); from it up they are waived. Null or
   * absent = no small-order charges.
   */
  smallOrder?: SmallOrderCharges | null;
  /** D-119: from `freeMinCents` up, the bulk saving (a % of the amount over the line, up to a cap). */
  bulkSaving?: BulkSaving | null;
}

/** D-119: the bulk saving's two numbers (store_bag_charges). */
export interface BulkSaving {
  pct: number;
  capCents: number;
}

/**
 * D-119: what a bag saves from the free-shipping line up: `pct` of the amount over the line, never more than the cap
 * (the saturation point: after it, pieces add at full price). 0 below the line or without the numbers.
 */
export function bulkSavingCents(subtotalCents: number, freeMinCents: number | null, bulk: BulkSaving | null | undefined): number {
  if (!bulk || freeMinCents === null || subtotalCents < freeMinCents || bulk.pct <= 0 || bulk.capCents <= 0) return 0;
  return Math.min(bulk.capCents, Math.round(((subtotalCents - freeMinCents) * bulk.pct) / 100));
}

/**
 * D-119: where a bag stands on the bulk saving, for the bag and the free-delivery pill: the saving now, whether it has
 * reached the cap, and how much more to spend to save one more dollar (null once capped or without a saving).
 */
export function bulkProgress(subtotalCents: number, freeMinCents: number | null, bulk: BulkSaving | null | undefined) {
  const savingCents = bulkSavingCents(subtotalCents, freeMinCents, bulk);
  const active = Boolean(bulk && bulk.pct > 0 && bulk.capCents > 0 && freeMinCents !== null);
  const capped = active && savingCents >= bulk!.capCents;
  return {
    savingCents,
    capped,
    capCents: active ? bulk!.capCents : 0,
    /** Spend this much more to save $1 more. */
    perDollarCents: active && !capped ? Math.round(10000 / bulk!.pct) : null,
    share: active ? Math.min(savingCents / bulk!.capCents, 1) : 0,
  };
}

/** A bag's charges as store_bag_charges() works them out (D-111, D-123, D-125). */
export interface SmallOrderCharges {
  /** Shipping below the free-shipping line: at least the parcel's amount, more when the bag's pieces cannot pay it. */
  shippingCents: number;
  /** D-125: what a bag past the line still pays as Shipping (0 for any bag whose prices pay its flight). */
  pastLineCents?: number | null;
  /** The retailer charges; with `retailerPct`, their minimum (D-123). */
  retailerCents: number;
  /** D-123: the retailer charges are this % of the goods, at least `retailerCents`. */
  retailerPct?: number | null;
}

/**
 * A bag's charges at a goods amount (D-111, D-112, D-123, D-125), for the bag, the pill, checkout and the profit check
 * alike. Below the free-shipping line Shipping and the retailer charges are paid; from it up both are struck through
 * (`waived*`) and free, except what a bag past the line still needs to pay its way (`pastLineCents`, D-125).
 */
export function bagChargesAt(goodsCents: number, freeMinCents: number | null, small: SmallOrderCharges | null) {
  const free = freeMinCents !== null && goodsCents >= freeMinCents;
  const shipping = small?.shippingCents ?? 0;
  const past = small?.pastLineCents ?? 0;
  const retailer = small
    ? Math.max(small.retailerCents, small.retailerPct ? Math.round((goodsCents * small.retailerPct) / 100) : 0)
    : 0;
  return {
    free,
    /** Shipping as paid, and as it would be (struck through) when free. */
    shippingCents: free ? past : shipping,
    waivedShippingCents: free && past === 0 ? shipping : 0,
    retailerCents: free ? 0 : retailer,
    waivedRetailerCents: free ? retailer : 0,
  };
}

/** Sales tax in the delivery state (D-073); null where IWC is not registered (no tax). */
export interface QuoteTax {
  ratePct: number;
}

export interface CheckoutBreakdown {
  subtotalCents: number;
  /** The promo's discount (the bulk saving is apart, below). */
  discountCents: number;
  /** D-119: the bulk saving from the free-shipping line up. */
  bulkSavingCents: number;
  /** Shipping paid (the flat rate or express, plus a small order's parcel shipping, D-111). */
  shippingCents: number;
  /** D-111: a small order's retailer charges (0 from the free-shipping line up). */
  retailerCents: number;
  /** D-111: what the small-order charges would have been, shown struck through once they are free. */
  waivedCents: { shipping: number; retailer: number };
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
  const small = method === 'standard' && shipping.smallOrder ? shipping.smallOrder : null;
  if (small) {
    assertCents(small.shippingCents, 'smallOrder.shippingCents');
    assertCents(small.retailerCents, 'smallOrder.retailerCents');
  }
  const charges = bagChargesAt(discounted, method === 'standard' ? shipping.freeMinCents : null, small);
  const shippingCents = freeShipping ? charges.shippingCents : price + charges.shippingCents;
  const retailerCents = freeShipping ? 0 : charges.retailerCents;
  if (shipping.bulkSaving) {
    assertCents(shipping.bulkSaving.capCents, 'bulkSaving.capCents');
    if (!(shipping.bulkSaving.pct >= 0)) throw new RangeError('bulkSaving.pct must be >= 0');
  }
  const bulkCents = bulkSavingCents(discounted, shipping.freeMinCents, shipping.bulkSaving);
  const goods = discounted - bulkCents;
  const taxableShare = subtotalCents === 0 ? 0 : taxableCents / subtotalCents;
  const taxCents = tax
    ? Math.round(((goods + shippingCents + retailerCents) * taxableShare * tax.ratePct) / 100)
    : 0;

  return {
    subtotalCents,
    discountCents,
    bulkSavingCents: bulkCents,
    shippingCents,
    retailerCents,
    waivedCents: freeShipping && small
      ? { shipping: charges.waivedShippingCents, retailer: charges.waivedRetailerCents }
      : { shipping: 0, retailer: 0 },
    taxCents,
    totalCents: goods + shippingCents + retailerCents + taxCents,
    promoApplied,
  };
}

/** "$12.50" from cents. */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

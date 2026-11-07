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
}

export interface QuotePromo {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderCents: number;
  /** D-191: a percentage coupon's most (10% up to $9); null or absent = no limit. */
  maxDiscountCents?: number | null;
}

/** Standard is the only shipping (D-187); orders placed earlier with Express keep their label. */
export type ShippingMethod = 'standard' | 'express';

/** From pricing_settings. NULL = not decided: that option can't be quoted. */
export interface ShippingSettings {
  /** Shipping per order (D-041: 0 = free). */
  flatCents: number | null;
  /** Ships free from this subtotal, before any coupon or coins (D-191; NULL = no threshold). */
  freeMinCents: number | null;
  /** D-187: the bulk saving and the heavy-item discount start here ($99.99, Settings), not at the free line. */
  bulkFromCents?: number | null;
  /**
   * D-111: below `freeMinCents`, a parcel pays Shipping (store_bag_charges), and from it up that is waived; the retailer
   * charges are always paid (D-191). Null or absent = no charges.
   */
  smallOrder?: SmallOrderCharges | null;
  /** D-119: from `bulkFromCents` up, the bulk saving (a % of the amount over the line, up to a cap). */
  bulkSaving?: BulkSaving | null;
  /** Heavy-item shipping (store_bag_charges). */
  heavy?: HeavyShipping | null;
}

/**
 * Heavy-item shipping (founder, 2026-10-24): heavy cookware (a steel cooker) is priced on half its weight and the other
 * half is this charge, added whenever such a piece is in the bag (price + charge = the price on the whole weight).
 */
export interface HeavyShipping {
  cents: number;
  /** From `bulkFromCents` up this % comes off it (20, Settings), the whole struck through. */
  lineOffPct: number;
}

/** What the bag pays as Heavy-item shipping, and the whole shown struck through when the line took some off. */
export function heavyShippingAt(
  heavy: HeavyShipping | null | undefined,
  lineReached: boolean,
): { cents: number; shownCents: number } {
  if (!heavy || heavy.cents <= 0) return { cents: 0, shownCents: 0 };
  const off = lineReached ? Math.round((heavy.cents * Math.min(Math.max(heavy.lineOffPct, 0), 100)) / 100) : 0;
  return { cents: heavy.cents - off, shownCents: off > 0 ? heavy.cents : 0 };
}

/** D-119: the bulk saving's two numbers (store_bag_charges). */
export interface BulkSaving {
  pct: number;
  capCents: number;
}

/**
 * D-119: what a bag saves from `fromCents` ($99.99, D-187) up: `pct` of the amount over it, never more than the cap
 * (the saturation point: after it, pieces add at full price). 0 below it or without the numbers.
 */
export function bulkSavingCents(
  subtotalCents: number,
  fromCents: number | null,
  bulk: BulkSaving | null | undefined,
): number {
  if (!bulk || fromCents === null || subtotalCents < fromCents || bulk.pct <= 0 || bulk.capCents <= 0) return 0;
  return Math.min(bulk.capCents, Math.round(((subtotalCents - fromCents) * bulk.pct) / 100));
}

/**
 * D-119: where a bag stands on the bulk saving, for the bag and the free-delivery pill: the saving now, whether it has
 * reached the cap, and how much more to spend to save one more dollar (null once capped or without a saving).
 */
export function bulkProgress(
  subtotalCents: number,
  fromCents: number | null,
  bulk: BulkSaving | null | undefined,
) {
  const savingCents = bulkSavingCents(subtotalCents, fromCents, bulk);
  const active = Boolean(bulk && bulk.pct > 0 && bulk.capCents > 0 && fromCents !== null);
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
  /**
   * D-140 (F5): the Shipping figure shown struck through once free (the bag's packed kg × the founder's $ a kg, at least
   * `shippingCents`). Display only: never charged, stored or sent to Stripe.
   */
  shownShippingCents?: number | null;
}

/**
 * A bag's charges at a goods amount (D-111, D-112, D-123, D-125), for the bag, the pill, checkout and the profit check
 * alike. Below the free-shipping line Shipping is paid; from it up it is struck through (`waived*`) and free, except what
 * a bag past the line still needs to pay its way (`pastLineCents`, D-125). The retailer charges are always paid (D-191).
 */
export function bagChargesAt(
  goodsCents: number,
  freeMinCents: number | null,
  small: SmallOrderCharges | null,
) {
  const free = freeMinCents !== null && goodsCents >= freeMinCents;
  const shipping = small?.shippingCents ?? 0;
  const past = small?.pastLineCents ?? 0;
  const retailer = small
    ? Math.max(
        small.retailerCents,
        small.retailerPct ? Math.round((goodsCents * small.retailerPct) / 100) : 0,
      )
    : 0;
  return {
    free,
    /** Shipping is struck through and free. */
    shippingFree: free && past === 0,
    /** Shipping as paid, and as it would be (struck through) when free. */
    shippingCents: free ? past : shipping,
    waivedShippingCents: free && past === 0 ? Math.max(shipping, small?.shownShippingCents ?? 0) : 0,
    retailerCents: retailer,
  };
}

/** Sales tax in the delivery state (D-073); null where IWC is not registered (no tax). */
export interface QuoteTax {
  ratePct: number;
}

export interface CheckoutBreakdown {
  subtotalCents: number;
  /** The coupon's discount (the bulk saving and the coins are apart, below). */
  discountCents: number;
  /** D-119: the bulk saving from $99.99 up (D-187); none while a coupon is on (D-191). */
  bulkSavingCents: number;
  /** D-191: the coins used; one coin is one cent off. */
  coinsUsed: number;
  /** Shipping paid (the flat rate, plus a small order's parcel shipping, D-111). */
  shippingCents: number;
  /** D-111, D-191: the retailer charges, paid on every bag from India. */
  retailerCents: number;
  /** D-111: what Shipping would have been, shown struck through once free. `retailer` is always 0 (D-191). */
  waivedCents: { shipping: number; retailer: number };
  /** Heavy-item shipping paid, and its whole shown struck through when $99.99 took some off (0: not shown). */
  heavyCents: number;
  heavyShownCents: number;
  taxCents: number;
  totalCents: number;
  promoApplied: boolean;
  /** D-191: the coupon was left off because the bulk saving is at least as much. */
  promoBeatenByBulk: boolean;
}

function assertCents(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative integer`);
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
  tax: QuoteTax | null = null,
  coins = 0,
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

  const price = shipping.flatCents;
  if (price === null) return null;
  assertCents(price, 'flatCents');
  if (shipping.freeMinCents !== null) assertCents(shipping.freeMinCents, 'freeMinCents');

  if (promo) assertCents(promo.discountValue, 'discountValue');
  if (shipping.bulkSaving) {
    assertCents(shipping.bulkSaving.capCents, 'bulkSaving.capCents');
    if (!(shipping.bulkSaving.pct >= 0)) throw new RangeError('bulkSaving.pct must be >= 0');
  }
  const bulkFrom = shipping.bulkFromCents ?? null;
  // D-191: a coupon replaces the bulk saving, so one worth no more than it stays off and the bag keeps the saving
  const bulkOnly = bulkSavingCents(subtotalCents, bulkFrom, shipping.bulkSaving);
  const coupon = promoDiscountCents(subtotalCents, promo);
  const promoReached = promo !== null && subtotalCents >= promo.minOrderCents;
  const promoApplied = promoReached && (coupon > bulkOnly || coupon === 0);
  const discountCents = promoApplied ? coupon : 0;
  const bulkCents = discountCents > 0 ? 0 : bulkOnly;

  // D-191: the free line reads the bag itself, so a coupon or coins can never bring Shipping back
  const freeShipping = shipping.freeMinCents !== null && subtotalCents >= shipping.freeMinCents;
  const small = shipping.smallOrder ?? null;
  if (small) {
    assertCents(small.shippingCents, 'smallOrder.shippingCents');
    assertCents(small.retailerCents, 'smallOrder.retailerCents');
  }
  const charges = bagChargesAt(subtotalCents, shipping.freeMinCents, small);
  const shippingCents = freeShipping ? charges.shippingCents : price + charges.shippingCents;
  const retailerCents = charges.retailerCents;
  const beforeCoins = subtotalCents - discountCents - bulkCents;
  const coinsUsed = Math.min(Math.max(Math.trunc(coins), 0), beforeCoins);
  const goods = beforeCoins - coinsUsed;
  // D-187: the same $99.99 takes its % off Heavy-item shipping
  const heavy = heavyShippingAt(shipping.heavy, bulkFrom !== null && subtotalCents >= bulkFrom);
  const taxableShare = subtotalCents === 0 ? 0 : taxableCents / subtotalCents;
  const taxCents = tax
    ? Math.round(((goods + shippingCents + retailerCents + heavy.cents) * taxableShare * tax.ratePct) / 100)
    : 0;

  return {
    subtotalCents,
    discountCents,
    bulkSavingCents: bulkCents,
    coinsUsed,
    shippingCents,
    retailerCents,
    waivedCents:
      freeShipping && small
        ? { shipping: charges.waivedShippingCents, retailer: 0 }
        : { shipping: 0, retailer: 0 },
    heavyCents: heavy.cents,
    heavyShownCents: heavy.shownCents,
    taxCents,
    totalCents: goods + shippingCents + retailerCents + heavy.cents + taxCents,
    promoApplied,
    promoBeatenByBulk: promoReached && !promoApplied,
  };
}

/** The promo's discount on a subtotal (0 below its minimum). The server works it out before asking for the bag's charges. */
export function promoDiscountCents(subtotalCents: number, promo: QuotePromo | null): number {
  if (!promo || subtotalCents < promo.minOrderCents || promo.discountValue < 0) return 0;
  if (promo.discountType !== 'percentage') return Math.min(promo.discountValue, subtotalCents);
  const off = Math.round((subtotalCents * Math.min(promo.discountValue, 100)) / 100);
  return promo.maxDiscountCents ? Math.min(off, promo.maxDiscountCents) : off;
}

/** "$12.50" from cents. */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}


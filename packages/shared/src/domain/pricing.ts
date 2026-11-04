/**
 * The automatic price of one piece (D-128), the same formula as the database's `_auto_price_cents()`, the source of
 * truth: prices are stored by the database. This copy previews a price on the listing forms as the admin types; a unit
 * test and a SQL test pin both to the same worked examples (D-187 removed the paused formula, archived in
 * docs/archive/pricing-full-formula.md).
 *
 * The founder's exact rules: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category's divisor (food 0.80, clothing 0.60,
 * home & gifts 0.50) ÷ ₹92, to the cent, no price ending.
 */
import type { ProductType } from './product-types';

type N = number | null;

/** The settings a price preview still reads: home & gifts without a weight (D-121). */
export interface PricingSettings {
  /** Grams per shop rupee. */
  homeEstGPerRupee?: N;
  /** The least it is estimated at. */
  homeEstMinG?: N;
}

/** D-128: the fixed numbers (the founder's exact rules), as the database's `_auto_price_cents()`. */
export const BETA_PRICING = {
  shopDivisor: 0.9,
  /** ₹2,000 a kg = ₹2 a gram = 200 paise a gram */
  shipPaisePerGram: 200,
  divisor: { food: 0.8, clothing: 0.6, home: 0.5 },
  inrPerUsd: 92,
} as const;

/** D-128: a piece's subtotal in rupees (adjusted cost + shipping), before the category's divisor. */
export function betaSubtotalInr(shopPaise: number, weightG: number): number {
  return (shopPaise / BETA_PRICING.shopDivisor + BETA_PRICING.shipPaisePerGram * weightG) / 100;
}

/** D-128: the category's divisor (clothing for anything else). */
export function betaDivisor(type: ProductType | null | undefined): number {
  return type === 'food' || type === 'home' ? BETA_PRICING.divisor[type] : BETA_PRICING.divisor.clothing;
}

export interface PriceBreakdown {
  /** The piece's cost before margin (cents). */
  costCents: number;
  priceCents: number;
}

/** A pricing_settings row (snake_case, as the database returns it) → what a price preview reads. */
export function pricingSettingsFrom(row: Record<string, unknown>): PricingSettings {
  const n = (key: string): N => (row[key] === null || row[key] === undefined ? null : Number(row[key]));
  return { homeEstGPerRupee: n('home_est_g_per_rupee'), homeEstMinG: n('home_est_min_g') };
}

/**
 * The weight a piece without its own is priced at (D-121), as the database's `_fallback_weight_g()`: home & gifts is
 * estimated from its shop price (grams per rupee, at least the minimum, at most the category's typical weight), so a
 * ₹200 basket is not priced as a 1.5 kg brass lamp; every other type takes its category's weight.
 */
export function fallbackWeightG(
  type: ProductType | null | undefined,
  shopPaise: number | null,
  categoryG: number | null,
  s: PricingSettings,
): number | null {
  if (type !== 'home' || s.homeEstGPerRupee == null || shopPaise === null) return categoryG;
  const est = Math.max(s.homeEstMinG ?? 1, Math.round((shopPaise / 100) * s.homeEstGPerRupee));
  return Math.min(categoryG ?? 50_000, est);
}

export function autoPrice(input: {
  shopPricePaise: number | null;
  weightG: number | null;
  productType?: ProductType | null;
}): PriceBreakdown | null {
  const { shopPricePaise: shop, weightG: g } = input;
  if (shop === null || g === null) return null;
  if (!Number.isInteger(shop) || shop < 0) throw new RangeError('shopPricePaise must be a non-negative integer');
  if (!Number.isInteger(g) || g <= 0) throw new RangeError('weightG must be a positive integer');
  const cost = (betaSubtotalInr(shop, g) * 100) / BETA_PRICING.inrPerUsd;
  return { costCents: Math.round(cost), priceCents: Math.round(cost / betaDivisor(input.productType)) };
}

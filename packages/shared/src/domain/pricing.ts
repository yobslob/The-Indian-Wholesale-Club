/**
 * The automatic price of one piece: the Amazon → door pilot (D-109, replacing D-075's formula while the pilot runs),
 * the same formula as the database's `_auto_price_cents()` (migration 38, the source of truth: prices are stored by
 * the database). This copy previews a price on the listing forms as the admin types; a unit test and a SQL test pin
 * both to the founder's worked examples.
 *
 * India cost (the rupee price + India handling %) and the shipping allocation by weight make the landed cost; the
 * margin applies to all of it, then the card fees; the price goes up to the next .29 / .49 / .79 / .99. Returns null
 * while any setting is missing: nothing is ever defaulted (D-047, D-069 keeps every number in Settings).
 */
export interface PricingSettings {
  fxInrPerUsd: number | null;
  fxBufferPct: number | null;
  indiaHandlingPct: number | null;
  shipAllocPaisePerKg: number | null;
  marginPct: number | null;
  cardFeePct: number | null;
  cardFeeFixedCents: number | null;
}

export interface PriceBreakdown {
  /** The rupee price with India handling, in cents. */
  goodsCents: number;
  /** The shipping allocation for the piece's weight, in cents. */
  logisticsCents: number;
  priceCents: number;
}

/** A pricing_settings row (snake_case, as the database returns it) → the formula's settings. */
export function pricingSettingsFrom(row: Record<string, unknown>): PricingSettings {
  const n = (key: string): number | null => (row[key] === null || row[key] === undefined ? null : Number(row[key]));
  return {
    fxInrPerUsd: n('fx_inr_per_usd'),
    fxBufferPct: n('fx_buffer_pct'),
    indiaHandlingPct: n('india_handling_pct'),
    shipAllocPaisePerKg: n('ship_alloc_paise_per_kg'),
    marginPct: n('margin_pct'),
    cardFeePct: n('card_fee_pct'),
    cardFeeFixedCents: n('card_fee_fixed_cents'),
  };
}

const ENDINGS = [29, 49, 79, 99];

/** Cents → up to the next price ending in .29, .49, .79 or .99 (D-109). */
export function priceEnding(cents: number): number {
  const c = Math.ceil(cents);
  return Math.floor(c / 100) * 100 + ENDINGS.find((e) => e >= c % 100)!;
}

export function autoPrice(
  input: { shopPricePaise: number | null; weightG: number | null },
  s: PricingSettings,
): PriceBreakdown | null {
  const values = Object.values(s);
  if (input.shopPricePaise === null || input.weightG === null || values.some((v) => v === null)) return null;
  const v = s as { [K in keyof PricingSettings]: number };
  if (!(v.fxInrPerUsd > 0)) throw new RangeError('fxInrPerUsd must be > 0');
  if (!Number.isInteger(input.shopPricePaise) || input.shopPricePaise < 0)
    throw new RangeError('shopPricePaise must be a non-negative integer');
  if (!Number.isInteger(input.weightG) || input.weightG <= 0) throw new RangeError('weightG must be a positive integer');

  const rate = v.fxInrPerUsd * (1 - v.fxBufferPct / 100);
  const goods = (input.shopPricePaise * (1 + v.indiaHandlingPct / 100)) / rate; // paise ÷ (₹ per $) = cents
  const shipping = (v.shipAllocPaisePerKg * input.weightG) / 1000 / rate;
  const price = ((goods + shipping) * (1 + v.marginPct / 100) + v.cardFeeFixedCents) / (1 - v.cardFeePct / 100);
  return { goodsCents: Math.round(goods), logisticsCents: Math.round(shipping), priceCents: priceEnding(price) };
}

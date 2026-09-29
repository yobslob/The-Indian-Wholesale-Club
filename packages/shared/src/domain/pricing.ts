/**
 * Suggested USD price from a shop price in INR (flows.md §2, step 4).
 * Every input comes from pricing_settings, set by the founder (D-047). When any
 * needed value is missing this returns null: nothing is ever defaulted or guessed.
 * The admin always sets the final price; this is only a suggestion.
 */
export interface PricingSettings {
  fxInrPerUsd: number | null;
  freightCentsPerKg: number | null;
  dutyPct: number | null;
  marginPct: number | null;
}

export interface PriceSuggestion {
  goodsCents: number;
  freightCents: number;
  dutyCents: number;
  landedCents: number;
  suggestedPriceCents: number;
}

export function suggestPrice(
  input: { shopPricePaise: number; weightG: number | null },
  settings: PricingSettings,
): PriceSuggestion | null {
  const { fxInrPerUsd: fx, freightCentsPerKg, dutyPct, marginPct } = settings;
  if (fx === null || freightCentsPerKg === null || dutyPct === null || marginPct === null) return null;
  if (input.weightG === null) return null;
  if (!(fx > 0)) throw new RangeError('fxInrPerUsd must be > 0');
  if (!Number.isInteger(input.shopPricePaise) || input.shopPricePaise < 0) {
    throw new RangeError('shopPricePaise must be a non-negative integer');
  }
  if (!Number.isInteger(input.weightG) || input.weightG <= 0) throw new RangeError('weightG must be a positive integer');

  // paise / 100 = rupees; rupees / fx = USD; USD * 100 = cents  =>  cents = paise / fx
  const goodsCents = Math.round(input.shopPricePaise / fx);
  const freightCents = Math.round((freightCentsPerKg * input.weightG) / 1000);
  // Duty on the goods' value only (US customs values goods excluding international freight; confirm with broker).
  const dutyCents = Math.round((goodsCents * dutyPct) / 100);
  const landedCents = goodsCents + freightCents + dutyCents;
  const suggestedPriceCents = Math.round(landedCents * (1 + marginPct / 100));
  return { goodsCents, freightCents, dutyCents, landedCents, suggestedPriceCents };
}

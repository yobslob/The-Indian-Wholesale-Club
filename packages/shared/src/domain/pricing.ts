/**
 * The automatic price of one piece (D-075), the same formula as the database's `_auto_price_cents()` (migration 24,
 * the source of truth: prices are stored by the database). This copy previews a price on the listing forms as the
 * admin types; a unit test and a SQL test pin both to the same hand-worked numbers.
 *
 * The margin applies to the goods only; logistics are recovered at cost, shipment and parcel costs by weight. Returns
 * null while any setting is missing: nothing is ever defaulted (D-047, D-069 keeps every number in Settings).
 */
export interface PricingSettings {
  fxInrPerUsd: number | null;
  fxBufferPct: number | null;
  indiaHandlingPaise: number | null;
  freightCentsPerKg: number | null;
  volumetricPct: number | null;
  brokerCentsPerShipment: number | null;
  shipmentKg: number | null;
  dutyPct: number | null;
  usHandlingCents: number | null;
  usLastMileCentsPerKg: number | null;
  usLastMileMinCents: number | null;
  returnsAllowancePct: number | null;
  marginPct: number | null;
  cardFeePct: number | null;
  cardFeeFixedCents: number | null;
}

export interface PriceBreakdown {
  goodsCents: number;
  logisticsCents: number;
  priceCents: number;
}

/** A pricing_settings row (snake_case, as the database returns it) → the formula's settings. */
export function pricingSettingsFrom(row: Record<string, unknown>): PricingSettings {
  const n = (key: string): number | null => (row[key] === null || row[key] === undefined ? null : Number(row[key]));
  return {
    fxInrPerUsd: n('fx_inr_per_usd'),
    fxBufferPct: n('fx_buffer_pct'),
    indiaHandlingPaise: n('india_handling_paise'),
    freightCentsPerKg: n('freight_cents_per_kg'),
    volumetricPct: n('volumetric_pct'),
    brokerCentsPerShipment: n('broker_cents_per_shipment'),
    shipmentKg: n('shipment_kg'),
    dutyPct: n('duty_pct'),
    usHandlingCents: n('us_handling_cents'),
    usLastMileCentsPerKg: n('us_last_mile_cents_per_kg'),
    usLastMileMinCents: n('us_last_mile_min_cents'),
    returnsAllowancePct: n('returns_allowance_pct'),
    marginPct: n('margin_pct'),
    cardFeePct: n('card_fee_pct'),
    cardFeeFixedCents: n('card_fee_fixed_cents'),
  };
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
  const goods = input.shopPricePaise / rate; // paise ÷ (₹ per $) = cents
  const india = v.indiaHandlingPaise / rate;
  const billedKg = (input.weightG * v.volumetricPct) / 100 / 1000;
  const logistics =
    india +
    v.freightCentsPerKg * billedKg +
    (v.brokerCentsPerShipment / v.shipmentKg) * billedKg +
    ((goods + india) * v.dutyPct) / 100 +
    v.usHandlingCents +
    Math.max(v.usLastMileMinCents, (v.usLastMileCentsPerKg * input.weightG) / 1000);
  const before = (goods * (1 + v.marginPct / 100) + logistics) * (1 + v.returnsAllowancePct / 100);
  const price = (before + v.cardFeeFixedCents) / (1 - v.cardFeePct / 100);
  return {
    goodsCents: Math.round(goods),
    logisticsCents: Math.round(logistics),
    priceCents: Math.ceil((price + 1) / 100) * 100 - 1, // up to the next $x.99
  };
}

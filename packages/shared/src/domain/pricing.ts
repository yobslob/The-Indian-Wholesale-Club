/**
 * The automatic price of one piece in two recipes (D-119), the same formula as the database's `_auto_price_cents()`
 * (migration 20261014090000, the source of truth: prices are stored by the database). This copy previews a price on
 * the listing forms as the admin types and drives the profit check in Settings; a unit test and a SQL test pin both
 * to the same worked examples.
 *
 * Clothing and home & gifts (the founder's formula): (shop ₹ ÷ divisor + g ÷ 100 × ₹ per 100 g) ÷ rate, ÷ (1 − margin),
 * the margin tapering down on expensive pieces. Food: (shop ₹ + fee) × (1 + India handling) ÷ rate + billed kg × the
 * courier rate card over a typical food parcel ÷ rate, × (1 + margin). Then the guard (the margin must pay US duty and
 * the card fee and leave a minimum profit) and up to .29 / .49 / .79 / .99. Null while a setting the recipe needs is
 * missing (D-047: nothing defaulted); an empty guard number counts as 0.
 *
 * Small food (D-120): a light, cheap food piece (a masala packet, a small snack) is priced on a shelf of whole-dollar
 * steps ($1.99, $2.99, $3.99): its goods at the food margin plus only part of its shipping share (the small-order
 * charges pay a small bag's courier), up to the next step, never below the goods' guard, at most the top step.
 */
import type { ProductType } from './product-types';

type N = number | null;

export interface PricingSettings {
  fxInrPerUsd: N;
  fxBufferPct: N;
  /** The general margin, for a type without its own. */
  marginPct: N;
  /** D-111: the margin of each product type (clothing and home: of the price; food: on top of cost). */
  typeMarginPct?: Partial<Record<ProductType, N>>;
  /** Clothing and home & gifts (D-119). */
  shopDivisor?: N;
  shipPaisePer100g?: N;
  /** The lowest margin, reached on the most expensive pieces; the taper runs between two costs in cents. */
  minMarginPct?: Partial<Record<'clothing' | 'home', N>>;
  taperCents?: Partial<Record<'clothing' | 'home', { from: N; to: N }>>;
  /** Food (D-119). */
  indiaHandlingPct?: N;
  foodFeePaise?: N;
  foodParcelKg?: N;
  foodBilledPct?: N;
  courierFirstKgPaise?: N;
  courierNextKgPaise?: N;
  parcelFixedPaise?: N;
  /** The profit guard (D-119). */
  dutyPct?: Partial<Record<ProductType, N>>;
  minProfitCents?: Partial<Record<ProductType, N>>;
  minProfitPct?: N;
  minProfitFoodPct?: N;
  guardCardFeePct?: N;
  /** Small food (D-120): which pieces (shop ₹ and grams at most), the shipping share they carry, the shelf. */
  smallFoodMaxShopPaise?: N;
  smallFoodMaxG?: N;
  smallFoodShipSharePct?: N;
  smallFoodFloorCents?: N;
  smallFoodCeilingCents?: N;
}

/** Which rule set a price: the type's recipe, its tapered margin, the guard (D-119) or the small-food shelf (D-120). */
export type PriceRule = 'recipe' | 'tapered' | 'guard' | 'small';

export interface PriceBreakdown {
  /** The piece's cost before margin (cents). */
  costCents: number;
  priceCents: number;
  rule: PriceRule;
}

/** A pricing_settings row (snake_case, as the database returns it) → the formula's settings. */
export function pricingSettingsFrom(row: Record<string, unknown>): PricingSettings {
  const n = (key: string): N =>
    row[key] === null || row[key] === undefined ? null : Number(row[key]);
  return {
    fxInrPerUsd: n('fx_inr_per_usd'),
    fxBufferPct: n('fx_buffer_pct'),
    marginPct: n('margin_pct'),
    typeMarginPct: {
      clothing: n('margin_clothing_pct'),
      food: n('margin_food_pct'),
      home: n('margin_home_pct'),
    },
    shopDivisor: n('shop_divisor'),
    shipPaisePer100g: n('ship_paise_per_100g'),
    minMarginPct: { clothing: n('margin_clothing_min_pct'), home: n('margin_home_min_pct') },
    taperCents: {
      clothing: { from: n('taper_clothing_from_cents'), to: n('taper_clothing_to_cents') },
      home: { from: n('taper_home_from_cents'), to: n('taper_home_to_cents') },
    },
    indiaHandlingPct: n('india_handling_pct'),
    foodFeePaise: n('food_fee_paise'),
    foodParcelKg: n('food_parcel_kg'),
    foodBilledPct: n('food_billed_pct'),
    courierFirstKgPaise: n('courier_first_kg_paise'),
    courierNextKgPaise: n('courier_next_kg_paise'),
    parcelFixedPaise: n('parcel_fixed_paise'),
    dutyPct: {
      clothing: n('duty_clothing_pct'),
      food: n('duty_food_pct'),
      home: n('duty_home_pct'),
    },
    minProfitCents: {
      clothing: n('min_profit_clothing_cents'),
      food: n('min_profit_food_cents'),
      home: n('min_profit_home_cents'),
    },
    minProfitPct: n('min_profit_pct'),
    minProfitFoodPct: n('min_profit_food_pct'),
    guardCardFeePct: n('guard_card_fee_pct'),
    smallFoodMaxShopPaise: n('small_food_max_shop_paise'),
    smallFoodMaxG: n('small_food_max_g'),
    smallFoodShipSharePct: n('small_food_ship_share_pct'),
    smallFoodFloorCents: n('small_food_floor_cents'),
    smallFoodCeilingCents: n('small_food_ceiling_cents'),
  };
}

const ENDINGS = [29, 49, 79, 99];

/** Cents → up to the next price ending in .29, .49, .79 or .99 (D-109). */
export function priceEnding(cents: number): number {
  const c = Math.ceil(cents - 1e-9);
  return Math.floor(c / 100) * 100 + ENDINGS.find((e) => e >= c % 100)!;
}

/** The margin for a product type (D-111): its own, else the general one. */
export function marginFor(s: PricingSettings, type?: ProductType | null): N {
  return (type ? s.typeMarginPct?.[type] : null) ?? s.marginPct;
}

/** The margin of a clothing or home piece costing `cost` cents: full up to `from`, lowest from `to` (D-119). */
export function taperedMargin(cost: number, hi: number, lo: N, from: N, to: N): number {
  if (lo === null || from === null || to === null || to <= from || cost <= from) return hi;
  if (cost >= to) return lo;
  return hi + ((lo - hi) * (cost - from)) / (to - from);
}

/** The courier rate card spread over a typical food parcel, in paise per kg (D-119). */
export function foodShippingPaisePerKg(s: PricingSettings): N {
  const { courierFirstKgPaise: first, courierNextKgPaise: next, foodParcelKg: kg } = s;
  if (first == null || next == null || kg == null || kg <= 0) return null;
  return (first + (kg - 1) * next + (s.parcelFixedPaise ?? 0)) / kg;
}

/**
 * A small food piece's step on the shelf (D-120). `goods` is its cost before shipping, `ship` its full shipping cost
 * and `guardGoods` the least its goods alone may sell for (the guard on the goods). Null when the piece is not small
 * food, the shelf is off (a number empty), or even the top step cannot pay for its goods.
 */
export function smallFoodPrice(
  shopPaise: number,
  g: number,
  parts: { goods: number; ship: number; margin: number; guardGoods: number },
  s: PricingSettings,
): number | null {
  const { smallFoodMaxShopPaise: maxShop, smallFoodMaxG: maxG, smallFoodShipSharePct: share } = s;
  const { smallFoodFloorCents: floor, smallFoodCeilingCents: ceiling } = s;
  if (maxShop == null || maxG == null || share == null || floor == null || ceiling == null) return null;
  if (shopPaise > maxShop || g > maxG || ceiling < floor || parts.guardGoods > ceiling) return null;
  const base = Math.max(parts.goods * (1 + parts.margin / 100) + (parts.ship * share) / 100, parts.guardGoods);
  // whole-dollar steps up from the bottom one ($1.99 → $2.99 → $3.99), at most the top one
  return Math.min(floor + Math.max(0, Math.ceil((base - floor - 1e-9) / 100)) * 100, ceiling);
}

export function autoPrice(
  input: {
    shopPricePaise: number | null;
    weightG: number | null;
    productType?: ProductType | null;
  },
  s: PricingSettings,
): PriceBreakdown | null {
  const { shopPricePaise: shop, weightG: g } = input;
  if (shop === null || g === null || s.fxInrPerUsd === null || s.fxBufferPct === null) return null;
  if (!(s.fxInrPerUsd > 0)) throw new RangeError('fxInrPerUsd must be > 0');
  if (!Number.isInteger(shop) || shop < 0)
    throw new RangeError('shopPricePaise must be a non-negative integer');
  if (!Number.isInteger(g) || g <= 0) throw new RangeError('weightG must be a positive integer');
  const rate = s.fxInrPerUsd * (1 - s.fxBufferPct / 100);
  const type: ProductType =
    input.productType === 'food' || input.productType === 'home' ? input.productType : 'clothing';
  const margin = marginFor(s, type);
  if (margin === null) return null;

  let cost: number;
  let goods = 0;
  let ship = 0;
  let price: number;
  let rule: PriceRule = 'recipe';
  let minPct: number;
  if (type === 'food') {
    const alloc = foodShippingPaisePerKg(s);
    if (alloc === null || s.indiaHandlingPct == null) return null;
    goods = ((shop + (s.foodFeePaise ?? 0)) * (1 + s.indiaHandlingPct / 100)) / rate;
    ship = (alloc * g * (s.foodBilledPct ?? 100)) / 100 / 1000 / rate;
    cost = goods + ship;
    price = cost * (1 + margin / 100);
    minPct = s.minProfitFoodPct ?? s.minProfitPct ?? 0;
  } else {
    if (s.shopDivisor == null || s.shipPaisePer100g == null || !(s.shopDivisor > 0)) return null;
    cost = (shop / s.shopDivisor + (s.shipPaisePer100g * g) / 100) / rate;
    const taper = s.taperCents?.[type];
    const m = taperedMargin(
      cost,
      margin,
      s.minMarginPct?.[type] ?? null,
      taper?.from ?? null,
      taper?.to ?? null,
    );
    if (m < margin - 1e-9) rule = 'tapered';
    price = cost / Math.max(0.05, 1 - m / 100);
    minPct = s.minProfitPct ?? 0;
  }

  // The guard: after duty (on what the customer pays) and the card fee, the minimum profit must be left.
  const cut = ((s.dutyPct?.[type] ?? 0) + (s.guardCardFeePct ?? 0)) / 100;
  const guardOf = (c: number) =>
    Math.max(
      (c + (s.minProfitCents?.[type] ?? 0)) / Math.max(0.05, 1 - cut),
      c / Math.max(0.05, 1 - cut - minPct / 100),
    );
  const guard = guardOf(cost);
  if (guard > price) rule = 'guard';
  const recipe = priceEnding(Math.max(price, guard));
  const small =
    type === 'food'
      ? smallFoodPrice(shop, g, { goods, ship, margin, guardGoods: guardOf(goods) }, s)
      : null;
  // on the shelf, but never dearer than its own recipe (a featherweight piece), and never under the bottom step
  if (small !== null)
    return {
      costCents: Math.round(cost),
      priceCents: Math.min(small, Math.max(s.smallFoodFloorCents ?? 0, recipe)),
      rule: 'small',
    };
  return { costCents: Math.round(cost), priceCents: recipe, rule };
}

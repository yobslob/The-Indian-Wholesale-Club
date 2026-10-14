/**
 * Every number in Settings, grouped as the founder thinks about them (D-069: the pilot's numbers, listed with their
 * basis in docs/pilot-numbers.md). One list drives both the page and its save action, so a new setting is one line.
 * Money is typed in dollars or rupees and stored in cents or paise; empty = not decided (D-047, nothing defaulted).
 */
export type FieldKind = 'usd' | 'inr' | 'int' | 'number' | 'pct';

export interface SettingField {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
}

export interface SettingGroup {
  title: string;
  note?: string;
  fields: SettingField[];
}

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Beta pricing is on (D-127)',
    note: 'Every automatic price uses the fixed beta formula: (shop ₹ × 1.10 India handling + weight kg × ₹2,000 flight) ÷ the exchange rate below (no buffer), then food +20% on cost, clothing 40% and home & gifts 50% of the price, to the cent (no price ending). The price numbers below are the full formula\'s, kept for after the beta (docs/archive/pricing-full-formula.md); they change no price while the beta is on. Bag charges (Shipping, retailer charges, bulk saving) still use them.',
    fields: [],
  },
  {
    title: 'Exchange rate (D-075)',
    note: 'Fetched by itself every day from the ECB reference rate. Prices follow automatically.',
    fields: [
      { key: 'fx_inr_per_usd', label: 'Rupees per US dollar (market)', kind: 'number' },
      { key: 'fx_buffer_pct', label: 'Safety buffer: price as if the rupee were this % weaker', kind: 'pct' },
    ],
  },
  {
    title: 'Pilot price: clothing and home & gifts (D-119)',
    note: 'Price = (shop ₹ ÷ the divisor + weight g ÷ 100 × ₹ per 100 g) ÷ rate, then ÷ (1 − margin). The margin eases from the type\'s margin down to its lowest margin as the cost before margin rises between the two dollar amounts, so a big piece does not land at twice its cost. Up to .29 / .49 / .69 / .79 / .99 (D-126).',
    fields: [
      { key: 'shop_divisor', label: 'Shop price ÷ (0.90 = a 10% cushion for price drift)', kind: 'number' },
      { key: 'ship_paise_per_100g', label: 'Shipping per 100 g (₹)', kind: 'inr' },
      { key: 'margin_clothing_pct', label: 'Clothing: margin of the price (%)', kind: 'pct' },
      { key: 'margin_clothing_min_pct', label: 'Clothing: lowest margin, on the dearest pieces (%)', kind: 'pct' },
      { key: 'taper_clothing_from_cents', label: 'Clothing: margin starts easing at a cost of ($)', kind: 'usd' },
      { key: 'taper_clothing_to_cents', label: 'Clothing: lowest margin from a cost of ($)', kind: 'usd' },
      { key: 'margin_home_pct', label: 'Home & gifts: margin of the price (%)', kind: 'pct' },
      { key: 'margin_home_min_pct', label: 'Home & gifts: lowest margin, on the dearest pieces (%)', kind: 'pct' },
      { key: 'taper_home_from_cents', label: 'Home & gifts: margin starts easing at a cost of ($)', kind: 'usd' },
      { key: 'taper_home_to_cents', label: 'Home & gifts: lowest margin from a cost of ($)', kind: 'usd' },
      { key: 'home_est_g_per_rupee', label: 'Home & gifts without a weight: grams per shop rupee (D-121; at most the category\'s weight)', kind: 'number' },
      { key: 'home_est_min_g', label: 'Home & gifts without a weight: at least (g)', kind: 'int' },
      { key: 'margin_pct', label: 'Margin for a type without its own (%)', kind: 'pct' },
    ],
  },
  {
    title: 'Pilot price: food (D-119, D-122)',
    note: 'Price = (shop ₹ + fee per piece) × (1 + India handling) ÷ rate + billed kg × the courier rate card spread over a typical food parcel ÷ rate × its share (D-122), then × (1 + margin). Up to .29 / .49 / .69 / .79 / .99. With a band top (D-126): food is priced at its margin up to the band top, the ending nearest the band, without the guard or the small-food shelf; a bag\'s Shipping brings what its pieces cannot (D-125).',
    fields: [
      { key: 'food_fee_paise', label: 'Shop fee per piece (₹): delivery and handling into the hub', kind: 'inr' },
      { key: 'india_handling_pct', label: 'India handling: cushion for price drift (% of the shop price)', kind: 'pct' },
      { key: 'margin_food_pct', label: 'Food: margin added on top of cost (%; the band\'s bottom)', kind: 'pct' },
      { key: 'food_margin_max_pct', label: 'Food: band top, margin on cost at most (%, D-126; empty = guard and shelf as before)', kind: 'pct' },
      { key: 'food_parcel_kg', label: 'A typical food parcel (kg)', kind: 'number' },
      { key: 'food_billed_pct', label: 'Billed weight, % of the label\'s weight (jars, bulky packs)', kind: 'pct' },
      { key: 'food_ship_share_pct', label: 'Share of its courier a food piece carries (%, D-122; empty = all of it, D-125)', kind: 'pct' },
    ],
  },
  {
    title: 'Small food shelf (D-120)',
    note: 'A light, cheap food piece (a masala packet, a small snack) carries only part of its shipping share, since a small bag pays its courier through the small-order charges, and is priced up to the next whole-dollar step: $1.99, $2.99, $3.99, at most the top step and never below what its goods cost after duty and the card fee. Empty any number to turn the shelf off. Not used while food has a band top (D-126).',
    fields: [
      { key: 'small_food_max_shop_paise', label: 'Pieces costing at most (shop ₹)', kind: 'inr' },
      { key: 'small_food_max_g', label: 'and weighing at most (g)', kind: 'int' },
      { key: 'small_food_ship_share_pct', label: 'Share of its shipping a shelf piece carries (%)', kind: 'pct' },
      { key: 'small_food_floor_cents', label: 'Bottom step ($)', kind: 'usd' },
      { key: 'small_food_ceiling_cents', label: 'Top step ($)', kind: 'usd' },
    ],
  },
  {
    title: 'Courier rate card (D-119)',
    note: 'Prices food\'s shipping, and the real cost of a parcel in the profit check below.',
    fields: [
      { key: 'courier_first_kg_paise', label: 'First kg (₹, incl. GST)', kind: 'inr' },
      { key: 'courier_next_kg_paise', label: 'Each further kg (₹, billed by the half kg)', kind: 'inr' },
      { key: 'parcel_fixed_paise', label: 'Fixed per parcel: box and customs clearance (₹)', kind: 'inr' },
    ],
  },
  {
    title: 'Profit guard, every piece (D-119)',
    note: 'US duty and card fees are paid from the margin. A price is lifted only where its margin cannot pay them (duty on what the customer pays) and still leave the minimum profit, in dollars and as a % of the price.',
    fields: [
      { key: 'duty_clothing_pct', label: 'US duty: clothing (%)', kind: 'pct' },
      { key: 'duty_food_pct', label: 'US duty: food (%)', kind: 'pct' },
      { key: 'duty_home_pct', label: 'US duty: home & gifts (%)', kind: 'pct' },
      { key: 'guard_card_fee_pct', label: 'Card fee (%)', kind: 'pct' },
      { key: 'min_profit_clothing_cents', label: 'Minimum profit per piece: clothing ($)', kind: 'usd' },
      { key: 'min_profit_food_cents', label: 'Minimum profit per piece: food ($)', kind: 'usd' },
      { key: 'min_profit_home_cents', label: 'Minimum profit per piece: home & gifts ($)', kind: 'usd' },
      { key: 'min_profit_pct', label: 'Minimum profit, % of the price: clothing and home', kind: 'pct' },
      { key: 'min_profit_food_pct', label: 'Minimum profit, % of the price: food', kind: 'pct' },
    ],
  },
  {
    title: 'Bag charges: shipping, retailer charges, bulk saving (D-111, D-119, D-123, D-125)',
    note: 'Below the free-shipping line a bag pays Shipping (at least the amount set; more when its pieces cannot pay for the parcel: the courier\'s first kg, box and clearance) and the retailer charges (a % of the goods, at least the amount set). From the line up both show struck through at $0.00. The bulk saving grows with every dollar over the line until its cap. No bag ever loses: the profit check below shows each one.',
    fields: [
      { key: 'free_shipping_min_cents', label: 'Shipping and retailer charges come off from ($)', kind: 'usd' },
      { key: 'small_order_shipping_cents', label: 'Shipping below the line, at least ($)', kind: 'usd' },
      { key: 'small_order_retailer_cents', label: 'Retailer charges, at least ($)', kind: 'usd' },
      { key: 'retailer_pct', label: 'Retailer charges: % of the goods (D-123; empty = the fixed amount above)', kind: 'pct' },
      { key: 'bulk_saving_pct', label: 'Bulk saving: % of the amount over the line', kind: 'pct' },
      { key: 'bulk_saving_cap_cents', label: 'Largest bulk saving ($)', kind: 'usd' },
      { key: 'min_order_cents', label: 'Smallest order that can check out ($, empty = none)', kind: 'usd' },
    ],
  },
  {
    title: 'Express: courier from Mumbai to the door (D-070)',
    fields: [
      { key: 'express_base_cents', label: 'Express per order ($)', kind: 'usd' },
      { key: 'express_courier_cents_per_kg', label: 'Courier per kg ($)', kind: 'usd' },
      { key: 'express_min_kg', label: 'Courier minimum billed kg', kind: 'number' },
      { key: 'express_days_min', label: 'Express days from the order: from', kind: 'int' },
      { key: 'express_days_max', label: 'Express days from the order: to', kind: 'int' },
    ],
  },
  {
    title: 'Standard delivery and shipping (D-008, D-041, D-115)',
    fields: [
      { key: 'pilot_delivery_days_min', label: 'Pilot, made to order: delivery days from the order: from (empty = cycles)', kind: 'int' },
      { key: 'pilot_delivery_days_max', label: 'Pilot, made to order: delivery days from the order: to', kind: 'int' },
      { key: 'domestic_days_min', label: 'US delivery days after the export arrives: from', kind: 'int' },
      { key: 'domestic_days_max', label: 'US delivery days after the export arrives: to', kind: 'int' },
      { key: 'shipping_flat_cents', label: 'Standard shipping per order ($, 0 = free)', kind: 'usd' },
      { key: 'express_shipping_cents', label: 'Express shipping per order, if not by weight ($)', kind: 'usd' },
    ],
  },
  {
    title: 'After the sale: cancels, returns, US clearance (D-071, D-072)',
    note: 'The order page offers what these allow, with the refund already worked out.',
    fields: [
      { key: 'cancel_fee_pct', label: 'Customer cancel once we started preparing (% of goods kept)', kind: 'pct' },
      { key: 'export_cancel_deduction_pct', label: 'Customer-care cancel after it left India (% of goods kept)', kind: 'pct' },
      { key: 'return_claim_days', label: 'Damaged or wrong: report within (days of delivery)', kind: 'int' },
      { key: 'return_tier1_days', label: 'Change of mind, first window (days)', kind: 'int' },
      { key: 'return_tier1_pct', label: 'First window: % kept for fetching', kind: 'pct' },
      { key: 'return_tier2_days', label: 'Second window (days)', kind: 'int' },
      { key: 'return_tier2_pct', label: 'Second window: % kept', kind: 'pct' },
      { key: 'return_tier3_days', label: 'Last window (days; after it, no returns)', kind: 'int' },
      { key: 'return_tier3_pct', label: 'Last window: % kept', kind: 'pct' },
      { key: 'clearance_discount_pct', label: 'US clearance price: % off what the customer paid', kind: 'pct' },
    ],
  },
  {
    title: 'Cycles and offers',
    fields: [
      { key: 'cycle_days', label: 'Days between cutoffs (D-063)', kind: 'int' },
      { key: 'fast_offer_cents', label: 'Faster-delivery offer ($, D-064)', kind: 'usd' },
      { key: 'stale_listing_days', label: 'Re-check shop quantities after (days)', kind: 'int' },
      { key: 'leaving_soon_max', label: 'Leaving soon lists pieces with at most (pieces, D-056)', kind: 'int', required: true },
    ],
  },
];

export const SETTING_FIELDS: SettingField[] = SETTING_GROUPS.flatMap((g) => g.fields);

/** The form value of a stored number. */
export function displayValue(kind: FieldKind, stored: number | null | undefined): string {
  if (stored === null || stored === undefined) return '';
  if (kind === 'usd' || kind === 'inr') return (Number(stored) / 100).toFixed(2);
  return String(Number(stored));
}

/** The stored number of a form value: null when empty, NaN when not a number (the action refuses it). */
export function storedValue(kind: FieldKind, typed: string): number | null {
  const text = typed.trim().replace(/[$₹,\s]/g, '');
  if (text === '') return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  if (kind === 'usd' || kind === 'inr') return Math.round(n * 100);
  if (kind === 'int') return Number.isInteger(n) ? n : Number.NaN;
  return n;
}

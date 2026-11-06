import type { Update } from '@repo/db';

/**
 * Every number in Settings, grouped as the founder thinks about them (docs/pilot-numbers.md). One list drives both the page and its save action, so a new setting is one line.
 * Money is typed in dollars or rupees and stored in cents or paise; empty = not decided (D-047, nothing defaulted).
 */
export type FieldKind = 'usd' | 'inr' | 'int' | 'number' | 'pct';

export interface SettingField {
  /** A column of pricing_settings: a column dropped from the database stops this file compiling. */
  key: Exclude<keyof Update<'pricing_settings'>, 'id' | 'updated_at' | 'updated_by'>;
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
    title: 'Prices (D-128)',
    note: 'Every automatic price uses the founder\'s exact rules, fixed in code: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category\'s divisor (food 0.80, clothing 0.60, home & gifts 0.50) ÷ a fixed ₹92 a dollar, to the cent. Only the two numbers below reach a price: saving a change to either re-prices the listings that use them.',
    fields: [
      { key: 'home_est_g_per_rupee', label: 'Home & gifts without a weight: grams per shop rupee (D-121; at most the category\'s weight)', kind: 'number' },
      { key: 'home_est_min_g', label: 'Home & gifts without a weight: at least (g)', kind: 'int' },
      {
        key: 'offer_pct',
        label: 'Struck-through prices: % of listings (D-190; 0 = none)',
        kind: 'int',
        required: true,
        hint: 'Display only, on a random set of the listings priced by the rules. The price charged does not change.',
      },
    ],
  },
  {
    title: 'Bag charges: shipping, retailer charges, bulk saving (D-111, D-119, D-123, D-187)',
    note: 'Shipping is the $ a kg × the bag\'s billed kg: its heaviest piece at least 1 kg, then by the half kg, and every other piece its own weight, food at its billed %, never under the whole bag by the half kg (D-190), one parcel for the whole bag even when it ships as two (D-154). Below the free-shipping line a bag pays it and the retailer charges (a % of the goods, at least the amount set); from the line up both show struck through at $0.00. The bulk saving and the heavy-item discount start at their own line: the saving grows with every dollar over it until its cap.',
    fields: [
      { key: 'free_shipping_min_cents', label: 'Free shipping from ($)', kind: 'usd' },
      { key: 'bulk_saving_from_cents', label: 'Bulk saving and heavy-item discount from ($)', kind: 'usd' },
      { key: 'shipping_cents_per_kg', label: 'Shipping per billed kg ($, D-154, D-190)', kind: 'usd', hint: 'Empty = the fixed Shipping below.' },
      { key: 'small_order_shipping_cents', label: 'Shipping when no $ a kg is set ($)', kind: 'usd' },
      { key: 'food_billed_pct', label: 'Food: billed weight, % of the label\'s weight (jars, bulky packs)', kind: 'pct' },
      { key: 'small_order_retailer_cents', label: 'Retailer charges, at least ($)', kind: 'usd' },
      { key: 'retailer_pct', label: 'Retailer charges: % of the goods (D-123; empty = the fixed amount above)', kind: 'pct' },
      { key: 'bulk_saving_pct', label: 'Bulk saving: % of the amount over its line', kind: 'pct' },
      { key: 'bulk_saving_cap_cents', label: 'Largest bulk saving ($)', kind: 'usd' },
      { key: 'heavy_line_off_pct', label: 'Heavy-item shipping: % off from its line (struck through; founder 2026-10-24: 20)', kind: 'pct' },
      { key: 'min_order_cents', label: 'Smallest order that can check out ($, empty = none)', kind: 'usd' },
      { key: 'shipping_flat_cents', label: 'Standard shipping per order ($, 0 = free)', kind: 'usd' },
    ],
  },
  {
    title: 'Delivery (D-008, D-187)',
    note: 'A delivery day is a business day, Monday to Friday, counted from the order. Orders already placed keep their dates.',
    fields: [
      { key: 'food_delivery_days_min', label: 'Food delivery days (business days): from', kind: 'int' },
      { key: 'food_delivery_days_max', label: 'Food delivery days (business days): to', kind: 'int' },
      { key: 'delivery_days_min', label: 'Clothing and home & gifts delivery days (business days): from', kind: 'int' },
      { key: 'delivery_days_max', label: 'Clothing and home & gifts delivery days (business days): to', kind: 'int' },
      { key: 'domestic_days_min', label: 'Already in the US: days to the door (calendar days): from', kind: 'int' },
      { key: 'domestic_days_max', label: 'Already in the US: days to the door (calendar days): to', kind: 'int' },
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
    title: 'Listings',
    fields: [
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

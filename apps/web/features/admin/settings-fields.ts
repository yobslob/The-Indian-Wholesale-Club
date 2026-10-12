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
    title: 'Exchange rate (D-075)',
    note: 'Fetched by itself every day from the ECB reference rate. Prices follow automatically.',
    fields: [
      { key: 'fx_inr_per_usd', label: 'Rupees per US dollar (market)', kind: 'number' },
      { key: 'fx_buffer_pct', label: 'Safety buffer: price as if the rupee were this % weaker', kind: 'pct' },
    ],
  },
  {
    title: 'Pilot price: online shop → door (D-109, D-111, D-112)',
    note: 'Price = (shop ₹ + India handling) ÷ rate + kg × shipping allocation, plus the type\'s margin on all of it; up to .29 / .49 / .79 / .99. The margins cover card fees, customs, returns and profit.',
    fields: [
      { key: 'india_handling_pct', label: 'India handling (safety buffer), % of the shop price', kind: 'pct' },
      { key: 'ship_alloc_paise_per_kg', label: 'Courier shipping allocation per kg (₹), inside every price', kind: 'inr' },
      { key: 'margin_clothing_pct', label: 'Margin: clothing (%)', kind: 'pct' },
      { key: 'margin_food_pct', label: 'Margin: food (%)', kind: 'pct' },
      { key: 'margin_home_pct', label: 'Margin: home & gifts (%)', kind: 'pct' },
      { key: 'margin_pct', label: 'Margin for anything else (%)', kind: 'pct' },
    ],
  },
  {
    title: 'Small orders (D-111, D-112)',
    note: 'Below the free-shipping line a bag pays these two fixed charges. From the line up they show struck through at $0.00.',
    fields: [
      { key: 'free_shipping_min_cents', label: 'Free shipping and no charges from ($)', kind: 'usd' },
      { key: 'small_order_shipping_cents', label: 'Shipping below the line ($)', kind: 'usd' },
      { key: 'small_order_retailer_cents', label: 'Retailer charges below the line ($)', kind: 'usd' },
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
    title: 'Standard delivery and shipping (D-008, D-041)',
    fields: [
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

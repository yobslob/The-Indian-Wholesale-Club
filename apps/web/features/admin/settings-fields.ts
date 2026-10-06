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
    title: 'Costs per piece, India side',
    fields: [{ key: 'india_handling_paise', label: 'Pickup, local transport and packing per piece (₹)', kind: 'inr' }],
  },
  {
    title: 'Standard: air freight Mumbai → US airport → warehouse (D-070)',
    fields: [
      { key: 'freight_cents_per_kg', label: 'Air freight per billed kg ($)', kind: 'usd' },
      { key: 'volumetric_pct', label: 'Billed weight as % of real weight (volume)', kind: 'pct' },
      { key: 'broker_cents_per_shipment', label: 'Customs broker, fees and bond per export ($)', kind: 'usd' },
      { key: 'shipment_kg', label: 'Billed kg in one export (shares the export costs)', kind: 'number' },
      { key: 'duty_pct', label: 'US duty on the value at export (%)', kind: 'pct' },
      { key: 'us_handling_cents', label: 'US warehouse handling per piece ($)', kind: 'usd' },
      { key: 'us_last_mile_cents_per_kg', label: 'US delivery to the customer per kg ($)', kind: 'usd' },
      { key: 'us_last_mile_min_cents', label: 'US delivery, smallest parcel ($)', kind: 'usd' },
    ],
  },
  {
    title: 'Margin, risk and card fees',
    fields: [
      { key: 'margin_pct', label: 'Margin on the goods (%)', kind: 'pct' },
      { key: 'returns_allowance_pct', label: 'Set aside for returns and damage (%)', kind: 'pct' },
      { key: 'card_fee_pct', label: 'Card fee (%)', kind: 'pct' },
      { key: 'card_fee_fixed_cents', label: 'Card fee per payment ($)', kind: 'usd' },
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
      { key: 'free_shipping_min_cents', label: 'Standard ships free from ($, empty = never)', kind: 'usd' },
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

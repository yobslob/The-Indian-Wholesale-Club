import { formatDeliveryWindow, formatOrderBy } from './delivery';

/**
 * D-154, D-187: what a bag's charges answer says about its shipments (store_bag_charges via /api/bag-charges). The
 * server decides; the bag, the pill and the app only show it.
 */
export interface BagShipmentFacts {
  /** The bag's options that are food (only ids the bag sent). */
  foodIds: string[];
  /** The food's total after the promo. */
  foodCents: number;
  /** Only food, to the 48 states and DC: one food shipment. */
  foodOnly: boolean;
  /** Food and other pieces, to the 48 states and DC: two shipments. */
  split: boolean;
  /** The address is outside the 48 states and DC (or a PO box, APO): everything in one shipment. */
  outside: boolean;
  /** Each shipment's estimated window, for checkout and the order page; store pages say "delivery days" (§1). */
  dates: { foodFrom: string | null; foodTo: string | null; standardFrom: string | null; standardTo: string | null };
}

/** none: one standard shipment (no food, or outside the 48 states) · food: one food shipment · split: two shipments. */
export type BagShipmentState = 'none' | 'food' | 'split';

export function bagShipmentState(f: BagShipmentFacts | null): BagShipmentState {
  if (!f) return 'none';
  if (f.split) return 'split';
  return f.foodOnly ? 'food' : 'none';
}

export interface BagGroup<L> {
  /** 1 or 2 when the bag ships as two; null for one shipment. */
  seq: 1 | 2 | null;
  kind: 'food' | 'standard';
  from: string | null;
  to: string | null;
  lines: L[];
}

/** The bag's lines under their shipments: two groups when it splits (Shipment 1 · Food, Shipment 2 · the rest), else one. */
export function bagGroups<L extends { variantId: string }>(lines: L[], f: BagShipmentFacts | null): BagGroup<L>[] {
  const state = bagShipmentState(f);
  const food = { kind: 'food' as const, from: f?.dates.foodFrom ?? null, to: f?.dates.foodTo ?? null };
  const standard = { kind: 'standard' as const, from: f?.dates.standardFrom ?? null, to: f?.dates.standardTo ?? null };
  if (state === 'split' && f) {
    const ids = new Set(f.foodIds);
    return [
      { seq: 1, ...food, lines: lines.filter((l) => ids.has(l.variantId)) },
      { seq: 2, ...standard, lines: lines.filter((l) => !ids.has(l.variantId)) },
    ];
  }
  return [{ seq: null, ...(state === 'food' ? food : standard), lines }];
}

/** "Arrives by Fri, Oct 30" for one day, "Arrives Nov 3 – Nov 7" for a window; null without dates. */
export function arrivalLine(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from || !to) return null;
  return from === to ? `Arrives by ${dayDate(to)}` : `Arrives ${formatDeliveryWindow(from, to)}`;
}

/** "Fri, Oct 30" for a calendar day (YYYY-MM-DD), whatever the device's zone. */
export function dayDate(day: string): string {
  return formatOrderBy(`${day}T12:00:00Z`, 'UTC');
}

/** The facts from /api/bag-charges' JSON (its `shipments`, `food_ids` and `dates`), for the web bag and the app; null when absent. */
export function parseBagShipments(raw: unknown): BagShipmentFacts | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const d = raw as Record<string, unknown>;
  const s = d.shipments;
  if (typeof s !== 'object' || s === null) return null;
  const sh = s as Record<string, unknown>;
  const dt = (typeof d.dates === 'object' && d.dates !== null ? d.dates : {}) as Record<string, unknown>;
  const int = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) ? v : null);
  const day = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  return {
    foodIds: Array.isArray(d.food_ids) ? d.food_ids.filter((x): x is string => typeof x === 'string') : [],
    foodCents: int(sh.food_cents) ?? 0,
    foodOnly: sh.food_only === true,
    split: sh.split === true,
    outside: sh.outside === true,
    dates: { foodFrom: day(dt.food_from), foodTo: day(dt.food_to), standardFrom: day(dt.standard_from), standardTo: day(dt.standard_to) },
  };
}

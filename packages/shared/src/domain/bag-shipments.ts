import { formatDeliveryWindow, formatOrderBy } from './delivery';
import { formatUsd } from './checkout';

/**
 * D-154: what a bag's charges answer says about its shipments (store_bag_charges via /api/bag-charges). The server
 * decides; the bag, the pill and the app only show it.
 */
export interface BagShipmentFacts {
  /** The bag's options that are 7-day pieces (only ids the bag sent). */
  quickIds: string[];
  /** The 7-day pieces' total after the promo. */
  quickCents: number;
  /** The 7-day line ($49.99); null while 7-day delivery is off. */
  minCents: number | null;
  /** Only 7-day pieces, worth the line: one 7-day shipment, free Shipping. */
  quickOnly: boolean;
  /** 7-day pieces worth the line and other pieces: two shipments. */
  split: boolean;
  /** How much more of 7-day pieces brings them in 7 days; null when none are in the bag or they are there already. */
  gapCents: number | null;
  /** The address is outside the 48 states and DC (or a PO box, APO): everything in one shipment. */
  outside: boolean;
  dates: { quickFrom: string | null; quickTo: string | null; standardFrom: string | null; standardTo: string | null };
}

/** none: no 7-day pieces · under: some, under the line · quick: one 7-day shipment · split: two shipments. */
export type BagShipmentState = 'none' | 'under' | 'quick' | 'split';

export function bagShipmentState(f: BagShipmentFacts | null): BagShipmentState {
  if (!f) return 'none';
  if (f.split) return 'split';
  if (f.quickOnly) return 'quick';
  return f.quickIds.length > 0 ? 'under' : 'none';
}

export interface BagGroup<L> {
  /** 1 or 2 when the bag ships as two; null for one shipment. */
  seq: 1 | 2 | null;
  kind: 'quick' | 'standard';
  from: string | null;
  to: string | null;
  lines: L[];
}

/** The bag's lines under their arrival dates: two groups when it splits, else one (D-154, "the bag shows its shipments"). */
export function bagGroups<L extends { variantId: string }>(lines: L[], f: BagShipmentFacts | null): BagGroup<L>[] {
  const state = bagShipmentState(f);
  const quick = { kind: 'quick' as const, from: f?.dates.quickFrom ?? null, to: f?.dates.quickTo ?? null };
  const standard = { kind: 'standard' as const, from: f?.dates.standardFrom ?? null, to: f?.dates.standardTo ?? null };
  if (state === 'split' && f) {
    const ids = new Set(f.quickIds);
    return [
      { seq: 1, ...quick, lines: lines.filter((l) => ids.has(l.variantId)) },
      { seq: 2, ...standard, lines: lines.filter((l) => !ids.has(l.variantId)) },
    ];
  }
  return [{ seq: null, ...(state === 'quick' ? quick : standard), lines }];
}

/** "Arrives by Fri, Oct 30" for one day, "Arrives Nov 3 – Nov 7" for a window; null without dates. */
export function arrivalLine(from: string | null | undefined, to: string | null | undefined): string | null {
  if (!from || !to) return null;
  return from === to ? `Arrives by ${dayDate(to)}` : `Arrives ${formatDeliveryWindow(from, to)}`;
}

/**
 * The 7-day pieces' dates for an order placed now: today + the 7-day days (Settings), counted from the order, any hour
 * (D-154), on the database's calendar (UTC), so the store switch and the 7-day front page say what the bag will.
 */
export function quickDates(daysMin: number, daysMax: number, now: Date = new Date()): { from: string; to: string } {
  const day = (n: number): string =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n)).toISOString().slice(0, 10);
  return { from: day(daysMin), to: day(daysMax) };
}

/** "arrives by Fri, Oct 30" (or "arrives Nov 3 – Nov 5"): the switch's and the front page's line. */
export function quickArrivesLine(daysMin: number, daysMax: number, now?: Date): string {
  const { from, to } = quickDates(daysMin, daysMax, now);
  const line = arrivalLine(from, to) ?? '';
  return line.charAt(0).toLowerCase() + line.slice(1);
}

/** "Fri, Oct 30" for a calendar day (YYYY-MM-DD), whatever the device's zone. */
export function dayDate(day: string): string {
  return formatOrderBy(`${day}T12:00:00Z`, 'UTC');
}

/** The 7-day meter: the 7-day pieces against the line, while they are under it. */
export function quickMeter(f: BagShipmentFacts | null): { cents: number; minCents: number; gapCents: number; share: number } | null {
  if (!f || f.gapCents === null || !f.minCents) return null;
  return { cents: f.quickCents, minCents: f.minCents, gapCents: f.gapCents, share: Math.min(f.quickCents / f.minCents, 1) };
}

/** "Add $12.40 of 7-day pieces and they arrive by Fri, Oct 30" (the plan's approved words). */
export function quickGapLine(f: BagShipmentFacts | null): string | null {
  const meter = quickMeter(f);
  if (!meter || !f?.dates.quickTo) return null;
  return `Add ${formatUsd(meter.gapCents)} of 7-day pieces and they arrive by ${dayDate(f.dates.quickTo)}`;
}

export interface BagMoment {
  facts: BagShipmentFacts | null;
  /** The bag's Shipping figure and whether it is charged now (not struck through). */
  shippingCents: number;
  shippingCharged: boolean;
  /** The free-delivery line. */
  freeMinCents: number | null;
}

/**
 * The pill's three-second note when a change moves the bag across a line (D-154): "Your 7-day pieces now arrive by
 * Fri, Oct 30", "That opened a second shipment: Nov 3 – Nov 7", and, when a normal piece ends a free 7-day bag's free
 * Shipping, "Shipping is now $46.55 until $99.99" with Undo. Null when nothing crossed a line.
 */
export function shipmentNote(prev: BagMoment | null, next: BagMoment): { text: string; undo: boolean } | null {
  if (!prev) return null;
  const was = bagShipmentState(prev.facts);
  const now = bagShipmentState(next.facts);
  if (was === now) return null;
  const f = next.facts;
  const quickBy = f?.dates.quickTo ? dayDate(f.dates.quickTo) : null;
  const window = f?.dates.standardFrom && f.dates.standardTo ? formatDeliveryWindow(f.dates.standardFrom, f.dates.standardTo) : null;
  if ((was === 'none' || was === 'under') && (now === 'quick' || now === 'split') && quickBy)
    return { text: `Your 7-day pieces now arrive by ${quickBy}`, undo: false };
  if (was === 'quick' && now === 'split') {
    if (!prev.shippingCharged && next.shippingCharged && next.freeMinCents !== null)
      return { text: `Shipping is now ${formatUsd(next.shippingCents)} until ${formatUsd(next.freeMinCents)}.`, undo: true };
    if (window) return { text: `That opened a second shipment: ${window}`, undo: false };
  }
  if ((was === 'split' || was === 'quick') && now === 'under' && window)
    return { text: `Your 7-day pieces now travel with the rest: ${window}`, undo: false };
  return null;
}

/** The facts from /api/bag-charges' JSON (its `shipments`, `quick_ids` and `dates`), for the web bag and the app; null when absent. */
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
    quickIds: Array.isArray(d.quick_ids) ? d.quick_ids.filter((x): x is string => typeof x === 'string') : [],
    quickCents: int(sh.quick_cents) ?? 0,
    minCents: int(sh.min_cents),
    quickOnly: sh.quick_only === true,
    split: sh.split === true,
    gapCents: int(sh.gap_cents),
    outside: sh.outside === true,
    dates: { quickFrom: day(dt.quick_from), quickTo: day(dt.quick_to), standardFrom: day(dt.standard_from), standardTo: day(dt.standard_to) },
  };
}

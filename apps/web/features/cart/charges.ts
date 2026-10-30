'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';

import {
  bagChargesAt,
  bagGoal,
  bagSavingCents,
  bulkProgress,
  heavyShippingAt,
  parseBagShipments,
  quickDates,
  shipmentNote,
  type BagMoment,
  type BagShipmentFacts,
  type BulkSaving,
  type HeavyShipping,
  type SmallOrderCharges,
} from '@repo/shared/domain';

import { cartSubtotalCents, useCart, type CartLine } from './store';

import type { ShellDays } from '@/features/shell/days';

/** D-111: a bag's small-order charges, as /api/bag-charges works them out (cents). */
export interface BagCharges {
  /** The bag this answer is for (bagKey): an answer for an earlier bag never decides the goal (bag-goal.ts). */
  key: string;
  freeMinCents: number | null;
  /** Shipping (the parcel, or what the bag needs to pay its way), the retailer charges' rule (D-111, D-123, D-125). */
  small: SmallOrderCharges;
  /** D-119: the bulk saving from the line up; null = none. */
  bulk: BulkSaving | null;
  /** D-154: which pieces are 7-day, the 7-day line and gap, a split, and each shipment's dates. */
  shipments: BagShipmentFacts | null;
  /** Heavy-item shipping (founder 2026-10-24): the bag's heavy pieces' charge (null = none) and which options. */
  heavy: HeavyShipping | null;
  heavyIds: string[];
}

/** D-154: the pill's three-second note when a change moved the bag across a line; `prevKey` is the bag before it (Undo). */
export interface ShipmentNote {
  text: string;
  undo: boolean;
  prevKey: string;
  until: number;
}

// Three seconds (the plan); one with Undo stays twice as long, so the button can be reached
const NOTE_MS = 3000;

// The last answer, kept for this tab (2026-10-30): a page load draws the pill at once from it while the bag is unchanged.
// Its bag's subtotal comes with it, so the next change after a page load still gets its note (shipmentNote needs the
// moment before).
const SAVED = 'iwc-bag-charges';
function saved(): { key: string; charges: BagCharges; moment: BagMoment | null } | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as {
      key?: unknown;
      data?: unknown;
      subtotal?: unknown;
    } | null;
    const charges = v && typeof v.key === 'string' ? parse(v.data, v.key) : null;
    if (!charges) return null;
    const subtotal = typeof v!.subtotal === 'number' && Number.isInteger(v!.subtotal) ? v!.subtotal : null;
    return { key: v!.key as string, charges, moment: subtotal === null ? null : momentOf(subtotal, charges) };
  } catch {
    return null;
  }
}

const useChargesStore = create<{
  key: string;
  charges: BagCharges | null;
  moment: BagMoment | null;
  note: ShipmentNote | null;
}>(() => {
  const last = saved();
  return { key: last?.key ?? '', charges: last?.charges ?? null, moment: last?.moment ?? null, note: null };
});
// The bag key asked for (or about to be): every component calling useBagCharges shares one request per bag.
let requested = '';
let pending: ReturnType<typeof setTimeout> | null = null;

/** The bag as the charges endpoint reads it: "<variant id>:<quantity>,…", sorted so one bag is one key (and one cache entry). */
export const bagKey = (lines: CartLine[]): string =>
  lines
    .map((l) => `${l.variantId}:${Math.min(Math.max(l.quantity, 1), 99)}`)
    .sort()
    .join(',');

function parse(data: unknown, key: string): BagCharges | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  const int = (v: unknown): number | null =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  const shippingCents = int(d.shipping_cents);
  const retailerCents = int(d.retailer_cents);
  if (shippingCents === null || retailerCents === null) return null;
  const num = (v: unknown): number => (typeof v === 'number' && v > 0 ? v : 0);
  const pct = num(d.bulk_saving_pct);
  const cap = int(d.bulk_saving_cap_cents) ?? 0;
  const charges = {
    key,
    freeMinCents: int(d.free_min_cents),
    small: {
      shippingCents,
      pastLineCents: int(d.past_line_cents) ?? 0,
      retailerCents,
      retailerPct: num(d.retailer_pct) || null,
      // D-140 (F5): the struck figure once free (display only)
      shownShippingCents: int(d.shown_shipping_cents),
      // D-154: a bag of only 7-day pieces from the 7-day line ships free
      quickFree: d.quick_free === true,
    },
    bulk: pct > 0 && cap > 0 ? { pct, capCents: cap } : null,
    shipments: parseBagShipments(d),
    heavy: (int(d.heavy_cents) ?? 0) > 0 ? { cents: int(d.heavy_cents)!, lineOffPct: num(d.heavy_line_off_pct) } : null,
    heavyIds: Array.isArray(d.heavy_ids) ? d.heavy_ids.filter((x): x is string => typeof x === 'string') : [],
  };
  learn(charges);
  return charges;
}

// Which options are 7-day, from every answer this tab has had (the answer names its bag's 7-day options; the others
// in its key are not): a piece taken out leaves the rest known, so the goal changes with the tap (bag-goal.ts).
const quickKnown = new Map<string, boolean>();
function learn(c: BagCharges): void {
  const quick = new Set(c.shipments?.quickIds ?? []);
  for (const part of c.key.split(',')) if (part) quickKnown.set(part.slice(0, 36), quick.has(part.slice(0, 36)));
}

/** Where a bag stands for the notes: its shipments and whether Shipping is charged. */
function momentOf(subtotalCents: number, charges: BagCharges): BagMoment {
  const at = bagChargesAt(subtotalCents, charges.freeMinCents, charges.small);
  return {
    facts: charges.shipments,
    shippingCents: at.shippingCents || at.waivedShippingCents,
    shippingCharged: at.shippingCents > 0,
    freeMinCents: charges.freeMinCents,
  };
}

/** The note while it lasts (three seconds), then null. */
export function useShipmentNote(): ShipmentNote | null {
  const note = useChargesStore((s) => s.note);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => tick((n) => n + 1), Math.max(note.until - Date.now(), 0) + 20);
    return () => clearTimeout(timer);
  }, [note]);
  return note && note.until > Date.now() ? note : null;
}

/** Undo: the bag as it was before the change ("Shipping is now $46.55 until $99.99. Undo", the plan's case 35). */
export function undoBagChange(prevKey: string): void {
  const before = new Map(
    prevKey
      .split(',')
      .filter(Boolean)
      .map((part) => [part.slice(0, 36), Number(part.slice(37))] as const),
  );
  const { lines, setQuantity, remove } = useCart.getState();
  for (const l of lines) {
    const q = before.get(l.variantId);
    if (q === undefined) remove(l.variantId);
    else if (q !== l.quantity) setQuantity(l.variantId, q);
  }
  useChargesStore.setState({ note: null });
}

/**
 * The current bag's charges, fetched once per bag (every component asking shares one request) a moment after it
 * changes. While a new answer is on its way the last one stays, so nothing flickers; null before the first.
 */
export function useBagCharges(): BagCharges | null {
  const lines = useCart((s) => s.lines);
  const key = bagKey(lines);
  const { key: have, charges } = useChargesStore();
  useEffect(() => {
    if (!key || key === have || key === requested) return;
    // Claimed before the wait, so the pill, the bag and the count mounting together send one request, not four
    requested = key;
    if (pending) clearTimeout(pending);
    // the first answer at once (the pill waits for it); later ones a moment after the last tap, so quick taps ask once
    const wait = useChargesStore.getState().charges ? 250 : 0;
    pending = setTimeout(() => {
      pending = null;
      fetch(`/api/bag-charges?items=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          const parsed = parse(data, key);
          if (!parsed) return;
          const subtotal = cartSubtotalCents(useCart.getState().lines);
          try {
            sessionStorage.setItem(SAVED, JSON.stringify({ key, data, subtotal }));
          } catch {
            // storage blocked: the next page asks again
          }
          const state = useChargesStore.getState();
          const moment = momentOf(subtotal, parsed);
          const note = shipmentNote(state.moment, moment);
          useChargesStore.setState({
            key,
            charges: parsed,
            moment,
            ...(note ? { note: { ...note, prevKey: state.key, until: Date.now() + NOTE_MS * (note.undo ? 2 : 1) } } : {}),
          });
        })
        .catch(() => undefined)
        .finally(() => {
          if (requested === key) requested = '';
        });
    }, wait);
  }, [key, have]);
  return key ? charges : null;
}

/**
 * What the bar and the bag say: how far from free delivery, whether the charges are waived and, from the line up,
 * the bulk saving so far (D-119). Founder 2026-10-30: the goal is the bag as it is now. The answer for this very bag
 * decides; while the next one is on its way (or before the first) the goal comes from the lines in Settings and which
 * pieces are 7-day (each line's word from its add, or an earlier answer), so the pill never shows an earlier bag's line.
 * The charges' figures (Shipping, Retailer charges) are the last answer's until then, as before. `shell`: the layout's
 * days and lines (useDays).
 */
export function freeDelivery(lines: CartLine[], charges: BagCharges | null, shell?: ShellDays) {
  const subtotal = cartSubtotalCents(lines);
  const fresh = charges !== null && charges.key === bagKey(lines);
  const line = charges?.freeMinCents ?? shell?.lines.freeMinCents ?? null;
  const free = line !== null && subtotal >= line;
  const bulk = bulkProgress(subtotal, line, charges?.bulk);
  const facts = fresh ? charges.shipments : null;
  const known = {
    quickIds: lines.filter((l) => quickKnown.get(l.variantId) ?? l.quick === true).map((l) => l.variantId),
    quickMinCents: charges?.shipments?.minCents ?? shell?.lines.quickMinCents ?? null,
    quickTo: charges?.shipments?.dates.quickTo ?? (shell?.quick ? quickDates(shell.quick.min, shell.quick.max).to : null),
  };
  const small = charges?.small ?? null;
  const goal = bagGoal({
    subtotalCents: subtotal,
    freeMinCents: line,
    at: bagChargesAt(subtotal, line, small),
    bulk,
    facts,
    variantIds: lines.map((l) => l.variantId),
    known,
  });
  // an earlier bag's answer: free 7-day Shipping follows this bag's goal, not that answer
  const at = bagChargesAt(subtotal, line, small && !fresh ? { ...small, quickFree: goal.kind === 'quick-free' } : small);
  return {
    subtotal,
    line,
    free,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at,
    /** Heavy-item shipping: paid, and its whole struck through once a line took its % off. */
    heavy: heavyShippingAt(charges?.heavy, free || at.shippingFree),
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
    bulk,
    /** The one goal the pill and the bag show (bag-goal.ts): never two bars. */
    goal,
  };
}

/** D-140 (F5): "You're saving $X" for this bag: the struck charges and the bulk saving (0 below the line). */
export function bagSaving(lines: CartLine[], charges: BagCharges | null, shell?: ShellDays): number {
  const f = freeDelivery(lines, charges, shell);
  // D-154: a bag of only 7-day pieces from the 7-day line saves its Shipping too, and the line's part of Heavy-item shipping
  const heavyOff = f.heavy.shownCents ? f.heavy.shownCents - f.heavy.cents : 0;
  return f.free || f.at.shippingFree ? bagSavingCents(f.at, f.bulk.savingCents) + heavyOff : 0;
}

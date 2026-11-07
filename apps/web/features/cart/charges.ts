'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import {
  bagChargesAt,
  bagGoal,
  bulkProgress,
  heavyShippingAt,
  parseBagShipments,
  type BagShipmentFacts,
  type BulkSaving,
  type HeavyShipping,
  type SmallOrderCharges,
} from '@repo/shared/domain';

import { cartSubtotalCents, useCart, type CartLine } from './store';

import type { ShellDays } from '@/features/shell/days';

/** D-111: a bag's small-order charges, as /api/bag-charges works them out (cents). */
export interface BagCharges {
  /** The bag this answer is for (bagKey): the charges' figures are the last answer's until the next one comes. */
  key: string;
  freeMinCents: number | null;
  /** D-187: the bulk saving and the heavy-item discount start here. */
  bulkFromCents: number | null;
  /** Shipping (the parcel, or what the bag needs to pay its way), the retailer charges' rule (D-111, D-123, D-125). */
  small: SmallOrderCharges;
  /** D-119: the bulk saving; null = none. */
  bulk: BulkSaving | null;
  /** D-187: which pieces are food and whether the bag splits. */
  shipments: BagShipmentFacts | null;
  /** Heavy-item shipping (founder 2026-10-24): the bag's heavy pieces' charge (null = none) and which options. */
  heavy: HeavyShipping | null;
  heavyIds: string[];
}

// The last answer, kept for this tab (2026-10-30): a page load draws the pill at once from it while the bag is unchanged.
const SAVED = 'iwc-bag-charges';
function saved(): { key: string; charges: BagCharges } | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as { key?: unknown; data?: unknown } | null;
    const charges = v && typeof v.key === 'string' ? parse(v.data, v.key) : null;
    return charges ? { key: charges.key, charges } : null;
  } catch {
    return null;
  }
}

const useChargesStore = create<{ key: string; charges: BagCharges | null }>(() => {
  const last = saved();
  return { key: last?.key ?? '', charges: last?.charges ?? null };
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
  return {
    key,
    freeMinCents: int(d.free_min_cents),
    bulkFromCents: int(d.bulk_saving_from_cents),
    small: {
      shippingCents,
      pastLineCents: int(d.past_line_cents) ?? 0,
      retailerCents,
      retailerPct: num(d.retailer_pct) || null,
      // D-140 (F5): the struck figure once free (display only)
      shownShippingCents: int(d.shown_shipping_cents),
    },
    bulk: pct > 0 && cap > 0 ? { pct, capCents: cap } : null,
    shipments: parseBagShipments(d),
    heavy: (int(d.heavy_cents) ?? 0) > 0 ? { cents: int(d.heavy_cents)!, lineOffPct: num(d.heavy_line_off_pct) } : null,
    heavyIds: Array.isArray(d.heavy_ids) ? d.heavy_ids.filter((x): x is string => typeof x === 'string') : [],
  };
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
          try {
            sessionStorage.setItem(SAVED, JSON.stringify({ key, data }));
          } catch {
            // storage blocked: the next page asks again
          }
          useChargesStore.setState({ key, charges: parsed });
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
 * What the bar and the bag say: how far from free delivery, whether the charges are waived and the bulk saving so far
 * (D-119, from its own line, D-187). The goal is the bag as it is now (founder 2026-10-30): the line comes from the last
 * answer or Settings, the subtotal from the lines. The charges' figures are the last answer's until the next one comes.
 * `shell`: the layout's days and line (useDays).
 */
export function freeDelivery(lines: CartLine[], charges: BagCharges | null, shell?: ShellDays) {
  const subtotal = cartSubtotalCents(lines);
  const line = charges?.freeMinCents ?? shell?.freeMinCents ?? null;
  const free = line !== null && subtotal >= line;
  const bulkFrom = charges?.bulkFromCents ?? null;
  const bulk = bulkProgress(subtotal, bulkFrom, charges?.bulk);
  const small = charges?.small ?? null;
  const at = bagChargesAt(subtotal, line, small);
  return {
    subtotal,
    line,
    free,
    /** Where the bulk saving and the heavy-item discount start. */
    bulkFrom,
    /** D-125: the charges at this bag's goods (Shipping, paid or struck through, and the retailer charges). */
    at,
    /** Heavy-item shipping: paid, and its whole struck through once its line took its % off. */
    heavy: heavyShippingAt(charges?.heavy, bulkFrom !== null && subtotal >= bulkFrom),
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
    bulk,
    /** The one goal the pill and the bag show (bag-goal.ts): never two bars. */
    goal: bagGoal({ subtotalCents: subtotal, freeMinCents: line, bulk }),
  };
}

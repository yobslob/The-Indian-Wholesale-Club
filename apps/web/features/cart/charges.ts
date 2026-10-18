'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import { bagChargesAt, bagSavingCents, bulkProgress, type BulkSaving, type SmallOrderCharges } from '@repo/shared/domain';

import { cartSubtotalCents, useCart, type CartLine } from './store';

/** D-111: a bag's small-order charges, as /api/bag-charges works them out (cents). */
export interface BagCharges {
  freeMinCents: number | null;
  /** Shipping (the parcel, or what the bag needs to pay its way), the retailer charges' rule (D-111, D-123, D-125). */
  small: SmallOrderCharges;
  /** D-119: the bulk saving from the line up; null = none. */
  bulk: BulkSaving | null;
}

const useChargesStore = create<{ key: string; charges: BagCharges | null }>(() => ({
  key: '',
  charges: null,
}));
let requested = '';

/** The bag as the charges endpoint reads it: "<variant id>:<quantity>,…", sorted so one bag is one key (and one cache entry). */
export const bagKey = (lines: CartLine[]): string =>
  lines
    .map((l) => `${l.variantId}:${Math.min(Math.max(l.quantity, 1), 99)}`)
    .sort()
    .join(',');

function parse(data: unknown): BagCharges | null {
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
    freeMinCents: int(d.free_min_cents),
    small: {
      shippingCents,
      pastLineCents: int(d.past_line_cents) ?? 0,
      retailerCents,
      retailerPct: num(d.retailer_pct) || null,
      // D-140 (F5): the struck figure once free (display only)
      shownShippingCents: int(d.shown_shipping_cents),
    },
    bulk: pct > 0 && cap > 0 ? { pct, capCents: cap } : null,
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
    const timer = setTimeout(() => {
      requested = key;
      fetch(`/api/bag-charges?items=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: unknown) => {
          const parsed = parse(data);
          if (parsed) useChargesStore.setState({ key, charges: parsed });
        })
        .catch(() => undefined)
        .finally(() => {
          if (requested === key) requested = '';
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [key, have]);
  return key ? charges : null;
}

/**
 * What the bar and the bag say: how far from free delivery, whether the charges are waived and, from the line up,
 * the bulk saving so far (D-119).
 */
export function freeDelivery(lines: CartLine[], charges: BagCharges | null) {
  const subtotal = cartSubtotalCents(lines);
  const line = charges?.freeMinCents ?? null;
  const free = line !== null && subtotal >= line;
  return {
    subtotal,
    line,
    free,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at: bagChargesAt(subtotal, line, charges?.small ?? null),
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
    bulk: bulkProgress(subtotal, line, charges?.bulk),
  };
}

/** D-140 (F5): "You're saving $X" for this bag: the struck charges and the bulk saving (0 below the line). */
export function bagSaving(lines: CartLine[], charges: BagCharges | null): number {
  const f = freeDelivery(lines, charges);
  return f.free ? bagSavingCents(f.at, f.bulk.savingCents) : 0;
}

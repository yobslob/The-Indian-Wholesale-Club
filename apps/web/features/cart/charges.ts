'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import { cartSubtotalCents, useCart, type CartLine } from './store';

/** D-111: a bag's small-order charges, as /api/bag-charges works them out (cents). */
export interface BagCharges {
  freeMinCents: number | null;
  shippingCents: number;
  retailerCents: number;
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
  return { freeMinCents: int(d.free_min_cents), shippingCents, retailerCents };
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

/** What the bar and the bag say: how far from free delivery, and whether the charges are waived. */
export function freeDelivery(lines: CartLine[], charges: BagCharges | null) {
  const subtotal = cartSubtotalCents(lines);
  const line = charges?.freeMinCents ?? null;
  const free = line !== null && subtotal >= line;
  return {
    subtotal,
    line,
    free,
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
  };
}

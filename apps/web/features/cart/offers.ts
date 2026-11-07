'use client';

import { useCallback, useEffect } from 'react';
import { create } from 'zustand';

import { takeWhoChanged } from './shopping-path';
import { useCart } from './store';

import type { CheckoutOffers } from '@repo/shared/domain';

/**
 * D-192: the bag's coupons and coins. One read per tab in five minutes, shared by the bag page and the panel, and only once
 * a bag is looked at; checkout's own read and each priced answer replace it. The server has the last word on every coupon.
 */
const SAVED = 'iwc-offers';
const KEEP_MS = 5 * 60_000;

function isOffers(v: unknown): v is CheckoutOffers {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.coupons) && typeof o.isNewCustomer === 'boolean' && (o.coins === null || typeof o.coins === 'number');
}

function saved(): { at: number; offers: CheckoutOffers } | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as { at?: unknown; offers?: unknown } | null;
    return v && typeof v.at === 'number' && isOffers(v.offers) ? { at: v.at, offers: v.offers } : null;
  } catch {
    return null;
  }
}

type Status = 'idle' | 'loading' | 'failed';
const useOffersStore = create<{ at: number; offers: CheckoutOffers | null; status: Status }>(() => {
  const last = saved();
  return { at: last?.at ?? 0, offers: last?.offers ?? null, status: 'idle' };
});

/** The last read said this customer already has a paid order. Unknown until a bag or checkout has read it. */
export function isKnownReturning(): boolean {
  return useOffersStore.getState().offers?.isNewCustomer === false;
}

/** Fresh offers from checkout's read or a priced answer. */
export function setOffers(offers: CheckoutOffers): void {
  const at = Date.now();
  useOffersStore.setState({ at, offers, status: 'idle' });
  try {
    sessionStorage.setItem(SAVED, JSON.stringify({ at, offers }));
  } catch {
    // storage blocked: the next page asks again
  }
}

/** Who is asking changed (a sign-in, a paid order): the next look reads again. */
export function forgetOffers(): void {
  useOffersStore.setState({ at: 0, offers: null, status: 'idle' });
  try {
    sessionStorage.removeItem(SAVED);
  } catch {
    // nothing kept
  }
}

async function read(code: string | null): Promise<CheckoutOffers | null> {
  const lines = useCart.getState().lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
  if (lines.length === 0) return null;
  const res = await fetch('/api/checkout/stock', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lines, promoCode: code }),
  });
  if (!res.ok) throw new Error(String(res.status));
  const offers = ((await res.json()) as { offers?: unknown }).offers;
  return isOffers(offers) ? offers : null;
}

async function load(): Promise<void> {
  if (useOffersStore.getState().status === 'loading') return;
  useOffersStore.setState({ status: 'loading' });
  try {
    const offers = await read(useCart.getState().promoCode);
    if (offers) setOffers(offers);
    else useOffersStore.setState({ status: 'failed' });
  } catch {
    useOffersStore.setState({ status: 'failed' });
  }
}

/** A code typed by hand: true when the server knows it and it may be used. */
export async function tryCode(code: string): Promise<boolean> {
  try {
    const offers = await read(code);
    if (!offers) return false;
    setOffers(offers);
    return offers.coupons.some((c) => c.code === code);
  } catch {
    return false;
  }
}

/** The offers, read when a bag is looked at (`fetchIfOld`); checkout passes false, as it reads them with the stock. */
export function useOffers(fetchIfOld = true): { offers: CheckoutOffers | null; failed: boolean; retry: () => void } {
  const { at, offers, status } = useOffersStore();
  const hasLines = useCart((s) => s.lines.length > 0);
  useEffect(() => {
    if (takeWhoChanged()) return forgetOffers(); // this runs again with nothing kept
    if (fetchIfOld && hasLines && status === 'idle' && Date.now() - at > KEEP_MS) void load();
  }, [fetchIfOld, hasLines, status, at]);
  const retry = useCallback(() => void load(), []);
  return { offers, failed: status === 'failed', retry };
}

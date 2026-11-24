'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import type { SendHome } from '@repo/db/store';

/**
 * D-205: is Send home on, and who a signed-in customer sends to. One read per tab in five minutes, only once a bag with
 * pieces is looked at (the bag page or checkout); forgotten on a sign-in or a paid order so the next look reads again.
 */
const SAVED = 'iwc-send-home';
const KEEP_MS = 5 * 60_000;

type State = { at: number; value: SendHome | undefined; loading: boolean };

function saved(): { at: number; value: SendHome } | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as { at?: unknown; value?: unknown } | null;
    return v && typeof v.at === 'number' && 'value' in v ? { at: v.at, value: v.value as SendHome } : null;
  } catch {
    return null;
  }
}

const useSettingsStore = create<State>(() => {
  const last = saved();
  return { at: last?.at ?? 0, value: last?.value, loading: false };
});

/** The read in flight: the card, the bill's line and both Checkout buttons ask at once, and share one request. */
let inFlight: Promise<void> | null = null;
/** A failed read is tried again after this, not at once (a refused read would otherwise ask in a loop). */
const RETRY_MS = 30_000;

function read(): Promise<void> {
  inFlight ??= readOnce().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function readOnce(): Promise<void> {
  useSettingsStore.setState({ loading: true });
  try {
    const res = await fetch('/api/send-home', { cache: 'no-store' });
    const body = (await res.json()) as { sendHome?: SendHome };
    if (!res.ok || body.sendHome === undefined) throw new Error('send home not read');
    const at = Date.now();
    useSettingsStore.setState({ at, value: body.sendHome, loading: false });
    try {
      sessionStorage.setItem(SAVED, JSON.stringify({ at, value: body.sendHome }));
    } catch {
      // storage blocked: the next page asks again
    }
  } catch {
    // no card this time: the bag works as before, and asks again in a little while
    useSettingsStore.setState({ at: Date.now() - KEEP_MS + RETRY_MS, loading: false, value: useSettingsStore.getState().value ?? null });
  }
}

/** Send home's settings for the bag: undefined while unknown, null when off. */
export function useSendHome(fetchIt = true): SendHome | undefined {
  const { at, value, loading } = useSettingsStore();
  useEffect(() => {
    if (fetchIt && !loading && Date.now() - at > KEEP_MS) void read();
  }, [fetchIt, at, loading]);
  return value;
}

export function sendHomeNow(): SendHome | undefined {
  return useSettingsStore.getState().value;
}

/** A sign-in, a new loved one saved, or a paid order: read again next time. */
export function forgetSendHome(): void {
  useSettingsStore.setState({ at: 0 });
  try {
    sessionStorage.removeItem(SAVED);
  } catch {
    // nothing kept
  }
}

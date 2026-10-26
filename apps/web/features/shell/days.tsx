'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

import { datesIn, dayShort } from '@repo/shared/domain';

type Days = { min: number; max: number } | null;

export interface ShellDays {
  /** The 7-day days (Settings); null while the 7-day store is off. */
  quick: Days;
  /** The standard days (the pilot's, Settings); null in cycle mode. */
  standard: Days;
}

const NONE: ShellDays = { quick: null, standard: null };
let current: ShellDays = NONE;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};

/**
 * The days every page counts its dates from (D-161), handed over once by the store layout from the cached policy and
 * kept in a small store (as the bag is), not a React context: the website and the app's React types meet in CI, where
 * a context provider in JSX does not type-check. The dates themselves are worked out in the browser (useToday), so a
 * page cached yesterday never shows yesterday's. It also tells the cards' 7-day tag its weekday: `--door-day` on
 * <html> ("Sat"), read by `.door-tag` in globals.css, so a cached card says "Sat at your door" with no script of its own.
 */
export function DaysProvider({ value }: { value: ShellDays }): null {
  const q = value.quick;
  useEffect(() => {
    current = value;
    for (const on of listeners) on();
  }, [value]);
  useEffect(() => {
    // one arrival day only: a window ("Nov 3 – Nov 5") keeps the card's "In 7 days"
    if (!q || q.min !== q.max) return;
    const root = document.documentElement;
    root.style.setProperty('--door-day', `"${dayShort(datesIn(q.min, q.max).to)}"`);
    root.dataset.doorDay = '';
    return () => {
      root.style.removeProperty('--door-day');
      delete root.dataset.doorDay;
    };
  }, [q]);
  return null;
}

/** The days, once the layout has handed them over (none on the server's paint). */
export const useDays = (): ShellDays => useSyncExternalStore(subscribe, () => current, () => NONE);

/** Now, once the page is in the browser; null on the server and the first paint (no date from a cached build). */
export function useToday(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

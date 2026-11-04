'use client';

import { useEffect, useSyncExternalStore } from 'react';

type Days = { min: number; max: number } | null;

export interface ShellDays {
  /** Food's delivery days (Settings). */
  food: Days;
  /** Clothing and home & gifts' delivery days (Settings). */
  standard: Days;
  /** The free-delivery line (Settings): the bag's pill picks its goal from it on its first draw (founder 2026-10-30). */
  freeMinCents: number | null;
}

const NONE: ShellDays = { food: null, standard: null, freeMinCents: null };
let current: ShellDays = NONE;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};

/**
 * The delivery days and the free line for the client parts (the bag, the pill), handed over once by the store layout from
 * the cached policy and kept in a small store (as the bag is), not a React context: the website and the app's React types
 * meet in CI, where a context provider in JSX does not type-check.
 */
export function DaysProvider({ value }: { value: ShellDays }): null {
  useEffect(() => {
    current = value;
    for (const on of listeners) on();
  }, [value]);
  return null;
}

/** The days, once the layout has handed them over (none on the server's paint). */
export const useDays = (): ShellDays => useSyncExternalStore(subscribe, () => current, () => NONE);

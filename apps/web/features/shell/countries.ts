'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { MARKET_NAME } from '@repo/shared/domain';

/**
 * D-208: the countries IWC sells in (store_countries: code and name), for Profile's list, the footer and checkout's
 * country field. One small request a tab, cached by the CDN a day (/api/country?list); the US, Canada, Australia and
 * New Zealand are named before it arrives.
 */
export interface Country {
  code: string;
  name: string;
}

const SAVED = 'iwc-countries';
let list: Country[] | null = null;
let asking = false;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};

function load(): void {
  if (list || asking) return;
  try {
    const v = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null') as Country[] | null;
    if (Array.isArray(v) && v.length > 0) {
      list = v;
      return;
    }
  } catch {
    // storage blocked: asked
  }
  asking = true;
  void fetch('/api/country?list')
    .then((r) => (r.ok ? (r.json() as Promise<{ countries?: Country[] }>) : null))
    .then((b) => {
      if (!b?.countries?.length) return;
      list = b.countries;
      try {
        sessionStorage.setItem(SAVED, JSON.stringify(list));
      } catch {
        // storage blocked
      }
      for (const on of listeners) on();
    })
    .catch(() => undefined)
    .finally(() => {
      asking = false;
    });
}

const FIRST: Country[] = (['us', 'ca', 'au', 'nz'] as const).map((code) => ({ code, name: MARKET_NAME[code] }));

/** The open countries (the four named ones until the list arrives). */
export function useCountries(): Country[] {
  useEffect(load, []);
  return useSyncExternalStore(
    subscribe,
    () => list ?? FIRST,
    () => FIRST,
  );
}

export function countryName(countries: Country[], code: string): string {
  return countries.find((c) => c.code === code)?.name ?? code.toUpperCase();
}

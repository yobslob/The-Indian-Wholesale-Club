import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { formatUsd, MARKET_NAME } from '@repo/shared/domain';

import { API_BASE_URL, apiPost } from '@/lib/api';

/**
 * D-208 in the app: the shopper's country (any country IWC sells in; the US to start, or where the phone is the first time
 * the app opens), kept on the phone, changed on Profile. Abroad every price carries that country's freight: the app asks
 * the website for the prices it shows (/api/country/prices, batched), as the website's pages do. The app shows US
 * dollars everywhere, written US$ abroad (checkout charges them).
 */
export interface PriceOf {
  variant?: string;
  heavy?: boolean;
  product?: string;
}
export interface Country {
  code: string;
  name: string;
}

const KEY = 'iwc_country';
let country = 'us';
let countries: Country[] = (['us', 'ca', 'au', 'nz'] as const).map((code) => ({ code, name: MARKET_NAME[code] }));
let version = 0;
const variants = new Map<string, { price: number; heavy: number }>();
const products = new Map<string, number>();
const askedV = new Set<string>();
const askedP = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const subscribe = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};
const tell = (): void => {
  version += 1;
  for (const on of listeners) on();
};

let started = false;
/** Once per launch: the saved country, the open list, and (the first time) where the phone is. */
function start(): void {
  if (started) return;
  started = true;
  void AsyncStorage.getItem(KEY).then(async (saved) => {
    if (saved && /^[a-z]{2}$/.test(saved)) {
      if (saved !== country) setCountry(saved, false);
    } else {
      const res = await fetch(`${API_BASE_URL}/api/country`).catch(() => null);
      const body = (await res?.json().catch(() => null)) as { country?: string | null } | null;
      if (body?.country) setCountry(body.country);
    }
  });
  void fetch(`${API_BASE_URL}/api/country?list`)
    .then((r) => r.json() as Promise<{ countries?: Country[] }>)
    .then((b) => {
      if (b.countries?.length) {
        countries = b.countries;
        tell();
      }
    })
    .catch(() => undefined);
}

/** A choice on Profile (kept on the phone); prices asked again for the new country. */
export function setCountry(code: string, keep = true): void {
  country = code;
  variants.clear();
  products.clear();
  if (keep) void AsyncStorage.setItem(KEY, code);
  tell();
}

async function flush(): Promise<void> {
  timer = null;
  const asking = country;
  const body = { country: asking, variants: [...askedV].slice(0, 200), products: [...askedP].slice(0, 200), recipes: [] };
  for (const id of body.variants) askedV.delete(id);
  for (const id of body.products) askedP.delete(id);
  const res = await apiPost<{ prices: null | { variants: Record<string, { price: number; heavy: number }>; products: Record<string, number> } }>(
    '/api/country/prices',
    body,
  );
  if (asking !== country || !res.ok) return;
  if (res.data.prices === null) return setCountry('us');
  for (const [id, v] of Object.entries(res.data.prices.variants)) variants.set(id, v);
  for (const [id, v] of Object.entries(res.data.prices.products)) products.set(id, v);
  for (const id of body.variants) if (!variants.has(id)) variants.set(id, { price: -1, heavy: -1 });
  for (const id of body.products) if (!products.has(id)) products.set(id, -1);
  tell();
}

/** The price `of` in the shopper's country (US cents), the figure itself in the US or without `of`; null while asked. */
export function countryCents(cents: number, of?: PriceOf): number | null {
  if (country === 'us' || !of) return cents;
  const pick = (v: number | undefined, ask: () => void): number | null => {
    if (v === undefined) {
      ask();
      if (!timer) timer = setTimeout(() => void flush(), 20);
      return null;
    }
    return v < 0 ? cents : v;
  };
  if (of.variant) {
    const v = variants.get(of.variant);
    return pick(v ? (of.heavy ? v.heavy : v.price) : undefined, () => askedV.add(of.variant!));
  }
  if (of.product) return pick(products.get(of.product), () => askedP.add(of.product!));
  return cents;
}

/** The shopper's country, the open countries and a formatter ("…" while a price abroad is on its way). */
export function useCountry(): {
  country: string;
  countries: Country[];
  format: (cents: number, of?: PriceOf) => string;
  cents: (cents: number, of?: PriceOf) => number | null;
} {
  useEffect(start, []);
  useSyncExternalStore(subscribe, () => version);
  const format = (cents: number, of?: PriceOf): string => {
    const local = countryCents(cents, of);
    if (local === null) return '…';
    return country === 'us' ? formatUsd(local) : formatUsd(local).replace('$', 'US$');
  };
  return { country, countries, format, cents: countryCents };
}

export const countryNameOf = (list: Country[], code: string): string => list.find((c) => c.code === code)?.name ?? code.toUpperCase();

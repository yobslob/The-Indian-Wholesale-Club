'use client';

/**
 * D-208: prices in the visitor's country. Store pages are cached with US prices and no weights (non-negotiable 1), so a
 * visitor abroad asks /api/country/prices for the pieces, cards and kits the page shows: every price that is drawn asks
 * for its own id, and the asks of one moment go as one request (at most 200 of each). Kept for the tab, per country.
 * The US never asks: its prices are the page's own.
 */

/** Which price a figure is: a piece (its own, or its Heavy-item shipping), a card (its cheapest option) or a kit. */
export interface PriceOf {
  variant?: string;
  heavy?: boolean;
  product?: string;
  recipe?: string;
  /** A sum of pieces (a kit as ticked). */
  variants?: string[];
}

interface Prices {
  variants: Record<string, { price: number; heavy: number }>;
  products: Record<string, number>;
  recipes: Record<string, number>;
}

const EMPTY = (): Prices => ({ variants: {}, products: {}, recipes: {} });
const SAVED = 'iwc-country-prices';
const known = new Map<string, Prices>();
const asked = { variants: new Set<string>(), products: new Set<string>(), recipes: new Set<string>() };
const listeners = new Set<() => void>();
let version = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let queueFor = '';
let onClosed: ((country: string) => void) | null = null;

export const subscribePrices = (on: () => void): (() => void) => {
  listeners.add(on);
  return () => listeners.delete(on);
};
export const pricesVersion = (): number => version;
const tell = (): void => {
  version += 1;
  for (const on of listeners) on();
};

/** What to do when the server says IWC does not sell in a country (a stale cookie): set by market.tsx. */
export function whenClosed(go: (country: string) => void): void {
  onClosed = go;
}

function pricesOf(country: string): Prices {
  let p = known.get(country);
  if (!p) {
    p = EMPTY();
    try {
      const v = JSON.parse(sessionStorage.getItem(`${SAVED}-${country}`) ?? 'null') as Prices | null;
      if (v && typeof v === 'object' && v.variants && v.products && v.recipes) p = v;
    } catch {
      // storage blocked: asked again
    }
    known.set(country, p);
  }
  return p;
}

function ask(country: string, kind: keyof Prices, id: string): void {
  if (queueFor !== country) {
    queueFor = country;
    asked.variants.clear();
    asked.products.clear();
    asked.recipes.clear();
  }
  asked[kind].add(id);
  if (!timer) timer = setTimeout(() => void flush(country), 20);
}

async function flush(country: string): Promise<void> {
  timer = null;
  const body = {
    country,
    variants: [...asked.variants].slice(0, 200),
    products: [...asked.products].slice(0, 200),
    recipes: [...asked.recipes].slice(0, 200),
  };
  for (const id of body.variants) asked.variants.delete(id);
  for (const id of body.products) asked.products.delete(id);
  for (const id of body.recipes) asked.recipes.delete(id);
  if (asked.variants.size + asked.products.size + asked.recipes.size > 0) timer = setTimeout(() => void flush(country), 0);
  try {
    const res = await fetch('/api/country/prices', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json()) as { prices?: Prices | null };
    if (res.ok && data.prices === null) return onClosed?.(country);
    if (!res.ok || !data.prices) return;
    const p = pricesOf(country);
    Object.assign(p.variants, data.prices.variants);
    Object.assign(p.products, data.prices.products);
    Object.assign(p.recipes, data.prices.recipes);
    // an id the server did not price (gone from the store) stays as the page has it
    for (const id of body.variants) p.variants[id] ??= { price: -1, heavy: -1 };
    for (const id of body.products) p.products[id] ??= -1;
    for (const id of body.recipes) p.recipes[id] ??= -1;
    try {
      sessionStorage.setItem(`${SAVED}-${country}`, JSON.stringify(p));
    } catch {
      // storage blocked: asked again next page
    }
    tell();
  } catch {
    // offline: the prices stay hidden until the next page asks again
  }
}

/**
 * The price `of` in `country` (US cents with that country's freight), or: `us` (the figure as the page has it) when no
 * id is given or the country is the US, and null while it is on its way (asked for now).
 */
export function countryCents(country: string, cents: number, of: PriceOf | undefined): number | null {
  if (country === 'us' || !of || typeof window === 'undefined') return cents;
  const p = pricesOf(country);
  const pick = (v: number | undefined, kind: keyof Prices, id: string): number | null => {
    if (v === undefined) {
      ask(country, kind, id);
      return null;
    }
    return v < 0 ? cents : v;
  };
  if (of.variants) {
    let sum = 0;
    for (const id of of.variants) {
      const v = pick(p.variants[id]?.price, 'variants', id);
      if (v === null) return null;
      sum += v;
    }
    return sum;
  }
  if (of.variant) {
    const v = p.variants[of.variant];
    return pick(v ? (of.heavy ? v.heavy : v.price) : undefined, 'variants', of.variant);
  }
  if (of.product) return pick(p.products[of.product], 'products', of.product);
  if (of.recipe) return pick(p.recipes[of.recipe], 'recipes', of.recipe);
  return cents;
}

/** The bag's pieces in a country (the bag reprices its lines with them, cart/country-bag.ts). */
export async function piecePrices(country: string, ids: string[]): Promise<Record<string, number> | null> {
  const res = await fetch('/api/country/prices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ country, variants: ids.slice(0, 200), products: [], recipes: [] }),
  });
  const data = (await res.json().catch(() => ({}))) as { prices?: Prices | null };
  if (res.ok && data.prices === null) {
    onClosed?.(country);
    return null;
  }
  if (!res.ok || !data.prices) return null;
  return Object.fromEntries(Object.entries(data.prices.variants).map(([id, v]) => [id, v.price]));
}

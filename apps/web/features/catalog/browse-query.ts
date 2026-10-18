import { z } from 'zod';

import { PRODUCT_TYPE_PATH, type ProductType } from '@repo/shared/domain';

import type { BrowseFilter, BrowsePage, BrowseSort } from '@repo/db/store';

/**
 * The See all pages' filters as the address carries them (D-136): ?state=, ?category=, ?for= (women or men, clothing,
 * D-140), ?min= and ?max= (whole dollars), ?size= (repeated), ?sort=, ?show=. Pure: the page, the /api/browse route and the filter panel share it.
 */
export interface BrowseQuery {
  state?: string;
  category?: string;
  /** D-140: clothing for women or men (unisex pieces show under both); no Kids at launch. */
  who?: Who;
  min?: number;
  max?: number;
  sizes: string[];
  sort: BrowseSort;
  /** How many cards are drawn ("Show more", D-067); absent = the first page. */
  show?: number;
}

export const WHO = ['women', 'men'] as const;
export type Who = (typeof WHO)[number];
export const WHO_LABEL: Record<Who, string> = { women: 'Women', men: 'Men' };

export const PAGE = 24;
/** The most cards one page draws (20 pages of "Show more"; the database allows 500). */
export const MOST = 480;

export const SORTS: { value: BrowseSort; label: string }[] = [
  { value: 'new', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

type Raw = URLSearchParams | Record<string, string | string[] | undefined>;

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined);
const dollars = z.coerce.number().int().min(0).max(100_000).optional().catch(undefined);
const size = z.string().trim().min(1).max(40);
const sort = z.enum(['new', 'price-asc', 'price-desc']).catch('new');
const show = z.coerce.number().int().min(PAGE + 1).max(MOST).optional().catch(undefined);

const all = (raw: Raw, key: string): string[] => {
  if (raw instanceof URLSearchParams) return raw.getAll(key);
  const v = raw[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};
const one = (raw: Raw, key: string): string | undefined => all(raw, key)[0];

/** The address's filters, checked: anything malformed is left out, as the page always did. */
export function parseBrowseQuery(raw: Raw): BrowseQuery {
  const sizes = [...new Set(all(raw, 'size').flatMap((s) => (size.safeParse(s).success ? [s.trim()] : [])))].slice(0, 20);
  let min = dollars.parse(one(raw, 'min'));
  let max = dollars.parse(one(raw, 'max'));
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  const who = WHO.find((w) => w === one(raw, 'for'));
  return {
    state: slug.parse(one(raw, 'state')),
    category: slug.parse(one(raw, 'category')),
    ...(who ? { who } : {}),
    min,
    max,
    sizes,
    sort: sort.parse(one(raw, 'sort') ?? 'new'),
    show: show.parse(one(raw, 'show')),
  };
}

/** The query string for a set of filters, always in the same order (so one filter set is one cached answer). */
export function browseSearch(q: BrowseQuery): string {
  const p = new URLSearchParams();
  if (q.state) p.set('state', q.state);
  if (q.category) p.set('category', q.category);
  if (q.who) p.set('for', q.who);
  if (q.min !== undefined) p.set('min', String(q.min));
  if (q.max !== undefined) p.set('max', String(q.max));
  for (const s of q.sizes) p.append('size', s);
  if (q.sort !== 'new') p.set('sort', q.sort);
  if (q.show) p.set('show', String(q.show));
  return p.toString();
}

/** The address customers see: /clothing?state=kerala&category=sarees&size=M. */
export function browseHref(productType: ProductType, q: BrowseQuery): string {
  const search = browseSearch(q);
  return search ? `${PRODUCT_TYPE_PATH[productType]}?${search}` : PRODUCT_TYPE_PATH[productType];
}

/** The database read for a set of filters: cards offset … offset + limit. */
export const toBrowseFilter = (productType: ProductType, q: BrowseQuery, offset: number, limit: number): BrowseFilter => ({
  productType,
  regionSlug: q.state,
  categorySlug: q.category,
  minCents: q.min !== undefined ? q.min * 100 : undefined,
  // whole dollars: "$20 to $30" includes a $30.00 piece
  maxCents: q.max !== undefined ? q.max * 100 : undefined,
  sizes: q.sizes,
  sort: q.sort,
  forWho: q.who,
  offset,
  limit,
});

/** True when any filter beyond the state and the category is set (those only the server's cached page knows). */
export const hasExtraFilters = (q: BrowseQuery): boolean =>
  q.min !== undefined || q.max !== undefined || q.sizes.length > 0 || q.sort !== 'new';

export const sameQuery = (a: BrowseQuery, b: BrowseQuery): boolean => browseSearch(a) === browseSearch(b);

/** The next query once a filter changes: a new state drops the category (a category lives within a state). */
export function withFilter(q: BrowseQuery, change: Partial<BrowseQuery>): BrowseQuery {
  const next: BrowseQuery = { ...q, ...change, show: undefined };
  if ('state' in change && change.state !== q.state) next.category = undefined;
  return next;
}

// ---------------------------------------------------------------- sizes

const LETTERS = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL', '4XL', '5XL', '6XL'];
const GRAMS: Record<string, number> = { mg: 0.001, g: 1, gm: 1, gms: 1, kg: 1000, ml: 1, l: 1000, ltr: 1000 };

/** Where a size sorts: letter sizes in wearing order, then numbers (kids' years, US, waist), weights, then the rest. */
function sizeRank(value: string): [number, number, string] {
  const v = value.trim().toUpperCase();
  const letter = LETTERS.indexOf(v.replace(/\s+/g, ''));
  if (letter >= 0) return [0, letter, v];
  if (/^FREE/.test(v) || v === 'ONE SIZE') return [5, 0, v];
  const weight = /^(\d+(?:\.\d+)?)\s*(MG|G|GM|GMS|KG|ML|L|LTR)\b/.exec(v);
  if (weight) return [3, Number(weight[1]) * (GRAMS[weight[2]!.toLowerCase()] ?? 1), v];
  const num = /(\d+(?:\.\d+)?)/.exec(v);
  if (num) return [/^\d/.test(v) ? 1 : 2, Number(num[1]), v.replace(/[\d.]+/g, '')];
  return [4, 0, v];
}

export function sortSizes<T extends { value: string }>(sizes: T[]): T[] {
  return [...sizes].sort((a, b) => {
    const [ga, na, ta] = sizeRank(a.value);
    const [gb, nb, tb] = sizeRank(b.value);
    // numbers of one kind (US 8, W30) stay together: group, then the text around the number, then the number
    return ga - gb || (ga === 2 ? ta.localeCompare(tb) : 0) || na - nb || ta.localeCompare(tb);
  });
}

// ---------------------------------------------------------------- prices

/** A round dollar amount near a price: $5 steps under $50, $10 under $200, else $25. */
function nice(cents: number): number {
  const d = cents / 100;
  const step = d < 50 ? 5 : d < 200 ? 10 : 25;
  return Math.max(step, Math.round(d / step) * step);
}

export interface PriceRange {
  label: string;
  min?: number;
  max?: number;
}

/** Four ready-made ranges from the prices shown (their quartiles, rounded), as on any big store's filters. */
export function priceRanges(prices: BrowsePage['prices']): PriceRange[] {
  if (!prices || prices.max - prices.min < 500) return [];
  const edges = [...new Set([nice(prices.q1), nice(prices.q2), nice(prices.q3)])]
    .filter((d) => d * 100 > prices.min && d * 100 < prices.max)
    .sort((a, b) => a - b);
  if (edges.length === 0) return [];
  const ranges: PriceRange[] = [{ label: `Up to $${edges[0]}`, max: edges[0] }];
  for (let i = 1; i < edges.length; i += 1)
    ranges.push({ label: `$${edges[i - 1]} to $${edges[i]}`, min: edges[i - 1], max: edges[i] });
  ranges.push({ label: `$${edges[edges.length - 1]} & above`, min: edges[edges.length - 1] });
  return ranges;
}

export const priceLabel = (q: Pick<BrowseQuery, 'min' | 'max'>): string | null =>
  q.min !== undefined && q.max !== undefined
    ? `$${q.min} to $${q.max}`
    : q.min !== undefined
      ? `$${q.min} & above`
      : q.max !== undefined
        ? `Up to $${q.max}`
        : null;

// ---------------------------------------------------------------- size groups (D-140)

export interface SizeGroup<T> {
  key: string;
  label: string;
  sizes: T[];
}

const SIZE_GROUPS: { key: string; label: string; test: (v: string) => boolean }[] = [
  { key: 'letters', label: 'Tops & kurtas', test: (v) => /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL)(\/(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL))?$/.test(v) },
  { key: 'waist', label: 'Waist', test: (v) => /^W?\s?(2[4-9]|[34]\d|5[0-2])$/.test(v) },
  { key: 'feet', label: 'Footwear', test: (v) => /^(UK|US|EU)\s?\d{1,2}(\.5)?$/.test(v) },
  { key: 'bangles', label: 'Bangles', test: (v) => /^2\.(1[0-4]|[0-9])$/.test(v) },
  { key: 'ages', label: "Kids' ages", test: (v) => /^KIDS?\s?\d+$|^\d+(\s?-\s?\d+)?\s?(M|Y|YRS?|MONTHS?|YEARS?)$/.test(v) },
  { key: 'one', label: 'One size', test: (v) => v === 'ONE SIZE' },
];

/**
 * See all's sizes in groups (D-140, plan F2): letter sizes, waist, footwear, bangles, kids' ages, one size, then the
 * rest; each group sorted in wearing order and shown only when the pieces in view use it (the server counts sizes with
 * the other filters applied, so a category's sizes are its own).
 */
export function sizeGroups<T extends { value: string }>(sizes: T[]): SizeGroup<T>[] {
  const groups = new Map<string, SizeGroup<T>>();
  for (const s of sortSizes(sizes)) {
    const v = s.value.trim().toUpperCase();
    const g = SIZE_GROUPS.find((x) => x.test(v)) ?? { key: 'other', label: 'Other sizes' };
    if (!groups.has(g.key)) groups.set(g.key, { key: g.key, label: g.label, sizes: [] });
    groups.get(g.key)!.sizes.push(s);
  }
  const order = [...SIZE_GROUPS.map((g) => g.key), 'other'];
  return [...groups.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

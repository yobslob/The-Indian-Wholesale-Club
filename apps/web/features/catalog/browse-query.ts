import { PRODUCT_TYPE_PATH, sortBySize, type ProductType } from '@repo/shared/domain';

import type { BrowseFilter, BrowsePage, BrowseSort } from '@repo/db/store';

/**
 * The See all pages' filters as the address carries them (D-136): ?state=, ?category=, ?sub= (D-191), ?for= (women or men,
 * clothing, D-140), ?min= and ?max= (whole dollars), ?size= (repeated), ?sort= (absent: Popular, D-191). Pure: the page, the
 * /api/browse route and the filter panel share it. An old ?show= or ?delivery= link lands on the first page (R-6).
 */
export interface BrowseQuery {
  state?: string;
  category?: string;
  /** D-191: a sub-category, from the rail. */
  sub?: string;
  /** D-140: clothing for women or men (unisex pieces show under both); no Kids at launch. */
  who?: Who;
  min?: number;
  max?: number;
  sizes: string[];
  sort: BrowseSort;
  /**
   * D-157: a state's own page (/states/punjab): its inventory as See all with the state fixed, so the address stays the
   * state page's (/states/punjab?type=food&category=sweets) and there is no State filter. Set by the page, with `state`.
   */
  inState?: string;
}

export const WHO = ['women', 'men'] as const;
export type Who = (typeof WHO)[number];
export const WHO_LABEL: Record<Who, string> = { women: 'Women', men: 'Men' };

export const PAGE = 24;
/** The most cards one read draws, and how deep the data cache goes (the database allows 500). */
export const MOST = 480;

/**
 * The Sort by choices. D-191: Popular by default: what sells, at moderate prices, one of each category then the next of each
 * (store_browse), replacing low to high (D-144), which buried the higher-priced pieces past where anyone scrolls.
 */
export const SORT_CHOICES: { value: BrowseSort; label: string }[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'new', label: 'Newest' },
];

type Raw = URLSearchParams | Record<string, string | string[] | undefined>;

// Checked by hand, not with zod: this file runs in the browser on every See all and state page, and zod alone was
// about 13 KB of their first-load JS (D-011's 150 KB budget). Same rules as the zod schemas it replaced.
const SLUG = /^[a-z0-9-]{1,80}$/;
const slug = { parse: (v: unknown): string | undefined => (typeof v === 'string' && SLUG.test(v) ? v : undefined) };
/** A whole number in [min, max] from the address ("" reads as 0, as zod's coerce did); anything else is dropped. */
const whole = (min: number, max: number) => ({
  parse: (v: unknown): number | undefined => {
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
  },
});
const dollars = whole(0, 100_000);
const size = { safeParse: (v: string) => ({ success: v.trim().length >= 1 && v.trim().length <= 40 }) };
const SORTS: BrowseSort[] = ['popular', 'new', 'price-asc', 'price-desc'];
// a saved ?sort=low link lands on the same list
const sort = { parse: (v: string): BrowseSort => (v === 'low' ? 'price-asc' : (SORTS.find((x) => x === v) ?? 'popular')) };

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
    ...(slug.parse(one(raw, 'sub')) ? { sub: slug.parse(one(raw, 'sub')) } : {}),
    ...(who ? { who } : {}),
    min,
    max,
    sizes,
    sort: sort.parse(one(raw, 'sort') ?? 'popular'),
  };
}

/** The query string for a set of filters, always in the same order (so one filter set is one cached answer). */
export function browseSearch(q: BrowseQuery): string {
  const p = new URLSearchParams();
  if (q.state) p.set('state', q.state);
  if (q.category) p.set('category', q.category);
  if (q.sub) p.set('sub', q.sub);
  if (q.who) p.set('for', q.who);
  if (q.min !== undefined) p.set('min', String(q.min));
  if (q.max !== undefined) p.set('max', String(q.max));
  for (const s of q.sizes) p.append('size', s);
  if (q.sort !== 'popular') p.set('sort', q.sort);
  return p.toString();
}

/** The address customers see: /clothing?state=kerala&category=sarees&size=M. */
export function browseHref(productType: ProductType, q: BrowseQuery): string {
  if (q.inState) {
    // the state page's own address: its type (Clothing has none) before the filters, the state in the path
    const rest = browseSearch({ ...q, state: undefined });
    const type = productType === 'clothing' ? '' : `type=${PRODUCT_TYPE_PATH[productType].slice(1)}`;
    const search = [type, rest].filter(Boolean).join('&');
    return search ? `/states/${q.inState}?${search}` : `/states/${q.inState}`;
  }
  const path = PRODUCT_TYPE_PATH[productType];
  const search = browseSearch(q);
  return search ? `${path}?${search}` : path;
}

/** D-157: a query on a state's own page: that state, always, and the state page's address. */
export const inStatePage = (q: BrowseQuery, region: string): BrowseQuery => ({ ...q, state: region, inState: region });

/** The database read for a set of filters: cards offset … offset + limit. */
export const toBrowseFilter = (productType: ProductType, q: BrowseQuery, offset: number, limit: number): BrowseFilter => ({
  productType,
  regionSlug: q.state,
  categorySlug: q.category,
  subSlug: q.sub,
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
  Boolean(q.sub) || q.min !== undefined || q.max !== undefined || q.sizes.length > 0 || q.sort !== 'popular';

export const sameQuery = (a: BrowseQuery, b: BrowseQuery): boolean => browseSearch(a) === browseSearch(b);

/** The next query once a filter changes: a new state drops the category (a category lives within a state), a new category its sub-category. */
export function withFilter(q: BrowseQuery, change: Partial<BrowseQuery>): BrowseQuery {
  const next: BrowseQuery = { ...q, ...change };
  if ('state' in change && change.state !== q.state) next.category = undefined;
  if ('category' in next && next.category !== q.category && !('sub' in change)) delete next.sub;
  return next;
}

// ---------------------------------------------------------------- sizes

/**
 * Letter sizes in wearing order, kids' ages by age, numbers of one kind (US 8, W30) together, weights, free size last:
 * the one size order every list uses (`@repo/shared/domain` sizes.ts, launch QA B-3).
 */
export function sortSizes<T extends { value: string }>(sizes: T[]): T[] {
  return sortBySize(sizes, (s) => s.value);
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

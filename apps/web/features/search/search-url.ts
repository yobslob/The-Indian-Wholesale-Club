import { SEARCH_SORTS, type SearchSort } from '@repo/db/store';
import { isProductType, type ProductType } from '@repo/shared/domain';
import { cleanSearch } from '@repo/shared/search';

type Param = string | string[] | undefined;
export type SearchParams = Promise<Record<string, Param>>;

/** Cards a page; "Show more" adds as many, up to 480. */
export const PAGE = 24;

/** A search as its address reads (D-2): what decides the results, nothing else. */
export interface SearchState {
  q: string;
  type: ProductType | null;
  category: string | null;
  state: string | null;
  sort: SearchSort | null;
  show: number;
  /** ?retry=1: the "Try again" address, never kept by the CDN, so it always asks the database afresh. */
  retry: boolean;
}

const first = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v);
const slug = (v: Param): string | null => {
  const s = first(v);
  return s && /^[a-z0-9-]{1,60}$/.test(s) ? s : null;
};

/** The words as the database reads them (lower case, spaces collapsed), so "Saree " and "saree" are one address. */
export const normalSearch = (text: string): string => cleanSearch(text).toLowerCase();

/** The search an address asks for; anything unknown or malformed is dropped. */
export function readSearch(params: Record<string, Param>): SearchState {
  const showRaw = Number(first(params.show));
  const typeRaw = first(params.type);
  const sortRaw = first(params.sort);
  return {
    q: normalSearch(first(params.q) ?? ''),
    type: isProductType(typeRaw) ? typeRaw : null,
    category: slug(params.category),
    state: slug(params.state),
    sort: (SEARCH_SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as SearchSort) : null,
    show: Math.min(Math.max(Number.isInteger(showRaw) ? showRaw : PAGE, PAGE), 480),
    retry: first(params.retry) === '1',
  };
}

/** The one address of a search: its parameters always in this order, defaults left out (the CDN keys by address). */
export function searchHref(base: string, s: SearchState): string {
  const entries: [string, string | null][] = [
    ['q', s.q || null],
    ['type', s.type],
    ['category', s.category],
    ['state', s.state],
    ['sort', s.sort],
    ['show', s.show !== PAGE ? String(s.show) : null],
    ['retry', s.retry ? '1' : null],
  ];
  const qs = new URLSearchParams(entries.filter((e): e is [string, string] => e[1] !== null));
  const text = qs.toString();
  return text ? `${base}?${text}` : base;
}

/** A plain search for these words: no filter, the first page. */
export const plainSearch = (q: string): SearchState => ({
  q,
  type: null,
  category: null,
  state: null,
  sort: null,
  show: PAGE,
  retry: false,
});

/** The search with some filters changed (null removes one), from the first page again; anything malformed is dropped. */
export function withFilters(s: SearchState, over: Record<string, string | null>): SearchState {
  const pick = (k: string, now: string | null): string | null => (k in over ? (over[k] ?? null) : now);
  const type = pick('type', s.type);
  const sort = pick('sort', s.sort);
  return {
    ...s,
    type: isProductType(type) ? type : null,
    category: slug(pick('category', s.category) ?? undefined),
    state: slug(pick('state', s.state) ?? undefined),
    sort: (SEARCH_SORTS as readonly string[]).includes(sort ?? '') ? (sort as SearchSort) : null,
    show: PAGE,
    retry: false,
  };
}

/** The address as it came, in the same form as searchHref, to tell whether it is already the one address. */
export function asCame(base: string, params: Record<string, Param>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) qs.append(k, one);
  const text = qs.toString();
  return text ? `${base}?${text}` : base;
}

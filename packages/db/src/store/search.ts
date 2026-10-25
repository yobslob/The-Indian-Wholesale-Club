/**
 * Search (D-160), website and app alike, through store_* only (D-017): one page of a search with its counts
 * (store_search_page) and the list the search boxes suggest from (store_search_hints). Until migration
 * 20261030090000 is applied (PostgREST: no such function) the page falls back to store_search, as before.
 */
import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';
import { EMPTY_HINTS, type SearchHints } from '@repo/shared/search';

import { unwrap, type IwcClient } from '../client';

import { productCardSchema, type ProductCard } from './schemas';

const productType = z.enum(PRODUCT_TYPES);
const count = z.number().int();

export const SEARCH_SORTS = ['price-asc', 'price-desc', 'new'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const searchPageSchema = z.object({
  query: z.string(),
  /** The words the search was answered with when it needed a spelling fix ("kurtha" → "kurta"). */
  fixed: z.string().nullable(),
  /** all: every word · fixed: every word once spelled as the listings do · some: pieces with some words · none. */
  mode: z.enum(['all', 'fixed', 'some', 'none']),
  total: count,
  /** Every match, whatever the filters. */
  all_total: count,
  /** Matches per type (with the state filter). */
  types: z.record(count).default({}),
  categories: z.array(z.object({ slug: z.string(), name: z.string(), type: productType, count })),
  regions: z.array(z.object({ slug: z.string(), name: z.string(), count })),
  /** The states the words name ("kerala", "punjabi"). */
  named_regions: z.array(z.string()),
  products: z.array(productCardSchema),
});
export type SearchPage = z.infer<typeof searchPageSchema>;

export interface SearchFilter {
  type?: ProductType;
  category?: string;
  region?: string;
  sort?: SearchSort;
  offset?: number;
  limit?: number;
  /** false for a re-read (Show more, a filter): only a first unfiltered page counts for Insights. */
  record?: boolean;
  /** D-154: only 7-day pieces. */
  quick?: boolean;
}

const missing = (code: string | undefined): boolean => code === 'PGRST202' || code === '42883';

const PRODUCT_CARD_COLUMNS =
  'id, slug, name, product_type, region_slug, region_name, category_slug, category_name, price_cents, primary_image_path';

/** store_search as before (no counts, no fixes): one more row than asked tells whether more are behind. */
async function oldSearch(client: IwcClient, query: string, f: SearchFilter): Promise<SearchPage> {
  const limit = f.limit ?? 24;
  const rows = z.array(productCardSchema).parse(
    unwrap(
      await client
        .rpc('store_search', {
          p_query: query,
          p_offset: f.offset ?? 0,
          p_limit: limit + 1,
          p_record: f.record ?? true,
          ...(f.quick ? { p_quick: true } : {}),
        })
        .select(PRODUCT_CARD_COLUMNS),
    ),
  );
  const all = rows.filter((p) => (!f.type || p.product_type === f.type) && (!f.region || p.region_slug === f.region));
  const products: ProductCard[] = all.slice(0, limit);
  const total = (f.offset ?? 0) + all.length;
  return {
    query,
    fixed: null,
    mode: products.length ? 'all' : 'none',
    total,
    all_total: total,
    types: {},
    categories: [],
    regions: [],
    named_regions: [],
    products,
  };
}

/** One page of a search with its counts (1 round trip; it records the first unfiltered page, so a POST). */
export async function searchPage(client: IwcClient, query: string, f: SearchFilter = {}): Promise<SearchPage> {
  const res = await client.rpc('store_search_page', {
    p_query: query,
    p_type: f.type,
    p_category: f.category,
    p_region: f.region,
    p_sort: f.sort,
    p_offset: f.offset ?? 0,
    p_limit: f.limit ?? 24,
    p_record: f.record ?? true,
    p_quick: f.quick ?? false,
  });
  if (missing(res.error?.code)) return oldSearch(client, query, f);
  return searchPageSchema.parse(unwrap(res));
}

export const searchHintsSchema = z.object({
  words: z.array(z.string()),
  synonyms: z.array(z.array(z.string())),
  categories: z.array(z.object({ type: productType, slug: z.string(), name: z.string(), count })),
  regions: z.array(z.object({ slug: z.string(), name: z.string(), count })),
  popular: z.array(z.string()),
});

/** The suggestions' list (1 round trip, a GET): empty until the migration is applied. */
export async function getSearchHints(client: IwcClient): Promise<SearchHints> {
  const res = await client.rpc('store_search_hints', undefined, { get: true });
  if (missing(res.error?.code)) return EMPTY_HINTS;
  return searchHintsSchema.parse(unwrap(res));
}

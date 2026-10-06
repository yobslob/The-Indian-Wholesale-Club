import 'server-only';

import { unstable_cache } from 'next/cache';

import {
  browseProducts,
  getHome,
  getProductPage,
  getRegionPage,
  getStorePolicy,
  listProductPaths,
  searchProducts as searchStore,
  type BrowseFilter,
} from '@repo/db/store';

import { storeClient } from '@/lib/supabase/store';

/**
 * Cached storefront reads (engineering.md PR-1, PR-2): one store_* round trip per page, shared across visitors.
 * Every entry carries STORE_TAG (admin changes refresh everything) and the tag of its own page, so a sale refreshes
 * only the pages whose stock numbers moved (revalidate.ts, §Caching). Otherwise entries refresh after
 * STORE_REVALIDATE_SECONDS.
 */
export const STORE_TAG = 'store';
export const STORE_REVALIDATE_SECONDS = 300;

export const homeTag = 'store:home';
export const regionTag = (regionSlug: string): string => `store:region:${regionSlug}`;
export const productTag = (regionSlug: string, productSlug: string): string =>
  `store:product:${regionSlug}/${productSlug}`;

/**
 * Part of every cache key. Bump it whenever a store_* result changes shape (a migration adds a field): cached
 * entries outlive deployments (Vercel's data cache, .next/cache locally), and an old entry would reach a page
 * that expects the new field. Last change: the product page's ships_from_us and is_us_stock (migration 26).
 */
const SHAPE = 'v12';

const cached = <T>(key: string[], tags: string[], load: () => Promise<T>): Promise<T> =>
  unstable_cache(load, [...key, SHAPE], { tags: [STORE_TAG, ...tags], revalidate: STORE_REVALIDATE_SECONDS })();

export const getHomeCached = () => cached(['store-home'], [homeTag], () => getHome(storeClient()));

export const getRegionPageCached = (regionSlug: string) =>
  cached(['store-region-page', regionSlug], [regionTag(regionSlug)], () =>
    getRegionPage(storeClient(), regionSlug),
  );

export const getProductPageCached = (regionSlug: string, productSlug: string) =>
  cached(['store-product-page', regionSlug, productSlug], [productTag(regionSlug, productSlug)], () =>
    getProductPage(storeClient(), regionSlug, productSlug),
  );

/** See all pages: light cards without stock, so a sale never has to refresh them (only STORE_TAG). */
export const browseCached = (filter: BrowseFilter) =>
  cached(
    ['store-browse', filter.productType, filter.regionSlug ?? '', filter.categorySlug ?? '', String(filter.limit ?? 24)],
    [],
    () => browseProducts(storeClient(), filter),
  );

/** The Shipping & returns page's numbers (migration 27); a settings save refreshes it with STORE_TAG. */
export const getStorePolicyCached = () => cached(['store-policy'], [], () => getStorePolicy(storeClient()));

export const listProductPathsCached = () =>
  cached(['store-product-paths'], [], () => listProductPaths(storeClient()));

/**
 * Search is per query: not cached (dynamic page, still one round trip). `limit` grows with "Show more", which reads
 * from the first result again; only the first read is recorded for Insights (C7).
 */
export function searchProducts(query: string, limit: number, record: boolean) {
  return searchStore(storeClient(), query, { limit, record });
}

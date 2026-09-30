import 'server-only';

import { unstable_cache } from 'next/cache';

import {
  getHome,
  getProductPage,
  getRegionPage,
  listProducts,
  type ProductListFilter,
} from '@repo/db/store';

import { storeClient } from '@/lib/supabase/store';

/**
 * Cached storefront reads (engineering.md PR-1, PR-2): one store_* round trip
 * per page, shared across visitors. Admin changes call revalidateTag(STORE_TAG);
 * otherwise entries refresh after STORE_REVALIDATE_SECONDS (stock counts move).
 */
export const STORE_TAG = 'store';
export const STORE_REVALIDATE_SECONDS = 300;

const options = { tags: [STORE_TAG], revalidate: STORE_REVALIDATE_SECONDS };

/**
 * Part of every cache key. Bump it whenever a store_* result changes shape (a migration adds a field): cached
 * entries outlive deployments (Vercel's data cache, .next/cache locally), and an old entry would reach a page
 * that expects the new field. Last change: reviews on the product page (migration 7).
 */
const SHAPE = 'v7';

export const getHomeCached = unstable_cache(() => getHome(storeClient()), ['store-home', SHAPE], options);

export const getRegionPageCached = unstable_cache(
  (regionSlug: string) => getRegionPage(storeClient(), regionSlug),
  ['store-region-page', SHAPE],
  options,
);

export const getProductPageCached = unstable_cache(
  (regionSlug: string, productSlug: string) =>
    getProductPage(storeClient(), regionSlug, productSlug),
  ['store-product-page', SHAPE],
  options,
);

export const listProductsCached = unstable_cache(
  (filter: ProductListFilter) => listProducts(storeClient(), filter),
  ['store-products', SHAPE],
  options,
);

/** Search is per query: not cached (dynamic page, still one round trip). */
export function searchProducts(query: string) {
  return listProducts(storeClient(), { search: query, limit: 40 });
}

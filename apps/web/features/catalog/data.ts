import 'server-only';

import { unstable_cache } from 'next/cache';

import {
  browseProducts,
  getHome,
  getProductPage,
  getQuickFront,
  getQuickPage,
  getRegionPage,
  getStorePolicy,
  isDemoStore,
  listProductPaths,
  searchProducts as searchStore,
  type BrowseFilter,
} from '@repo/db/store';

import { quickCategories } from '@/features/seven-day/links';
import { storeClient } from '@/lib/supabase/store';

import { slimCards } from './slim-cards';

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
/** Every state page, for an all-India piece that sits on all of them (D-121, D-145). */
export const regionsTag = 'store:regions';
/** The See all pages and the sitemap: whatever lists every listing (D-145). */
export const listingsTag = 'store:listings';

/**
 * Part of every cache key. Bump it whenever a store_* result changes shape (a migration adds a field): cached
 * entries outlive deployments (Vercel's data cache, .next/cache locally), and an old entry would reach a page
 * that expects the new field. Last change: store_browse's sizes and prices, store_home's just_listed_types (D-136).
 */
// v16: store_browse adds 'wears' and the For filter; v17: cards carry their options; v18: Home's band (D-140);
// v19: store_browse's drawer (D-144); v20: cards keep their options out of the cache and the page (D-145)
const SHAPE = 'v20';

const cached = <T>(key: string[], tags: string[], load: () => Promise<T>): Promise<T> =>
  unstable_cache(async () => slimCards(await load()), [...key, SHAPE], { tags: [STORE_TAG, ...tags], revalidate: STORE_REVALIDATE_SECONDS })();

// v2: Home's album (D-113); a new key so no entry cached before it (without the album) is read back.
export const getHomeCached = () => cached(['store-home-v2'], [homeTag], () => getHome(storeClient()));

export const getRegionPageCached = (regionSlug: string) =>
  cached(['store-region-page', regionSlug], [regionsTag, regionTag(regionSlug)], () =>
    getRegionPage(storeClient(), regionSlug),
  );

export const getProductPageCached = (regionSlug: string, productSlug: string) =>
  cached(['store-product-page', regionSlug, productSlug], [productTag(regionSlug, productSlug)], () =>
    getProductPage(storeClient(), regionSlug, productSlug),
  );

/**
 * See all pages and their filters (/api/browse, D-136): light cards without stock, so a sale never has to refresh
 * them (only STORE_TAG). One entry per filter set and page.
 */
const browseKey = (filter: BrowseFilter): string[] => [
  filter.productType,
  filter.regionSlug ?? '',
  filter.categorySlug ?? '',
  String(filter.minCents ?? ''),
  String(filter.maxCents ?? ''),
  (filter.sizes ?? []).join('|'),
  filter.sort ?? 'new',
  filter.forWho ?? '',
  filter.quick ? 'quick' : '',
  String(filter.offset ?? 0),
  String(filter.limit ?? 24),
];

export const browseCached = (filter: BrowseFilter) =>
  cached(['store-browse', ...browseKey(filter)], [listingsTag], () => browseProducts(storeClient(), filter));

/**
 * D-157: a state page's own inventory (each type's first cards): refreshed with its state, like the state page was
 * before, so a sale shows "Sold out" on the state's page at once (revalidate.ts). Its own entries: See all's stay as
 * they are. One more data-cache entry per type when a state's piece sells; no extra page.
 */
export const browseStateCached = (filter: BrowseFilter & { regionSlug: string }) =>
  cached(
    ['store-browse-state', ...browseKey(filter)],
    [listingsTag, regionsTag, regionTag(filter.regionSlug)],
    () => browseProducts(storeClient(), filter),
  );

/**
 * The 7-day store's first cards and its categories with their types (D-148): Home's "Arrives in 7 days" row and the
 * front page's tiles, refreshed with the listings (listingsTag). One entry per category and page.
 */
export const quickPageCached = (category: string | null, offset: number, limit: number) =>
  cached(['store-quick', category ?? '', String(offset), String(limit)], [listingsTag], () =>
    getQuickPage(storeClient(), { category, offset, limit }),
  );

/** D-154: the 7-day store's front page (its tiles and rows), refreshed with the listings like its list. */
export const getQuickFrontCached = () => cached(['store-quick-front'], [listingsTag], () => getQuickFront(storeClient()));

/**
 * D-154: what the header needs on every page for the store switch and the 7-day store's links: the days and the
 * categories, nothing else; null while the 7-day store is off, paused or empty. Only STORE_TAG (like the demo flag), so a listing change never rebuilds every page.
 */
export const getQuickNavCached = () =>
  cached(['store-quick-nav'], [], async () => {
    const [front, page] = await Promise.all([
      getQuickFront(storeClient()),
      getQuickPage(storeClient(), { offset: 0, limit: 1 }),
    ]);
    // an empty 7-day store has no door; a category's link needs its type (/7-day-delivery/food?category=sweets)
    return front && front.total > 0
      ? {
          daysMin: front.days_min,
          daysMax: front.days_max,
          categories: quickCategories(front.categories, page.categories).slice(0, 4),
        }
      : null;
  });
export type QuickNav = Awaited<ReturnType<typeof getQuickNavCached>>;

/** Demo mode (D-078): the banner on every store page. Refreshed with STORE_TAG or within 5 minutes. */
export const isDemoStoreCached = () => cached(['store-demo'], [], () => isDemoStore(storeClient()));

/** The Shipping & returns page's numbers (migration 27); a settings save refreshes it with STORE_TAG. */
export const getStorePolicyCached = () => cached(['store-policy'], [], () => getStorePolicy(storeClient()));

export const listProductPathsCached = () =>
  cached(['store-product-paths'], [listingsTag], () => listProductPaths(storeClient()));

/**
 * Search is per query: not cached (dynamic page, still one round trip). `limit` grows with "Show more", which reads
 * from the first result again; only the first read is recorded for Insights (C7).
 */
export function searchProducts(query: string, limit: number, record: boolean, quick = false) {
  return searchStore(storeClient(), query, { limit, record, quick });
}

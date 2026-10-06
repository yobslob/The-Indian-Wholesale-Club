import 'server-only';

import { revalidateTag } from 'next/cache';

import { getNextDelivery } from '@repo/db/store';

import { storeClient } from '@/lib/supabase/store';

import { getHomeCached, homeTag, productTag, regionTag, STORE_TAG } from './data';

/** A product page, by the slugs its URL and cache entry use. */
export interface ProductPageRef {
  regionSlug: string;
  productSlug: string;
}

/**
 * After a sale (engineering.md §Caching): the pages whose stock numbers just moved are rebuilt on their next visit:
 * each product's page (pieces left, sold out), its region page (cards, Leaving soon, Most wanted) and Home (Just
 * listed). See all pages carry no stock and stay cached; Similar items on other product pages catch up within the
 * 5-minute fallback (their Add is re-checked at checkout anyway). Without refs (an old stored checkout) everything.
 */
export function revalidateAfterSale(pages: ProductPageRef[]): void {
  if (pages.length === 0) {
    revalidateTag(STORE_TAG);
    return;
  }
  revalidateTag(homeTag);
  for (const regionSlug of new Set(pages.map((p) => p.regionSlug))) revalidateTag(regionTag(regionSlug));
  for (const p of pages) revalidateTag(productTag(p.regionSlug, p.productSlug));
}

/** Pieces went back to stock (a cancel): rare, so everything. */
export function revalidateAfterRelease(): void {
  revalidateTag(STORE_TAG);
}

/**
 * The cached "order by" time has passed (D-008): the cycle closed by itself (roll_cycles) and the store must show the
 * next window. Called every minute by the scheduler's job; refreshes at most once per cutoff. Returns whether it did.
 */
export async function revalidateIfCutoffPassed(): Promise<boolean> {
  const cached = (await getHomeCached()).delivery;
  if (!cached || Date.parse(cached.order_by) > Date.now()) return false;
  const live = await getNextDelivery(storeClient());
  if (live?.order_by === cached.order_by) return false; // never purge twice for the same window
  revalidateTag(STORE_TAG);
  return true;
}

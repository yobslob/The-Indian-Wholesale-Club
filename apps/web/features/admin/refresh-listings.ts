import 'server-only';

import { revalidateTag } from 'next/cache';

import { listListingPages } from '@repo/db/admin';
import { regionSegment } from '@repo/shared/domain';

import { homeTag, listingsTag, productTag, regionsTag, regionTag, STORE_TAG } from '@/features/catalog/data';

type Client = Parameters<typeof listListingPages>[0];

/** More listings than this at once (a bulk publish) and the whole store is refreshed instead. */
const MANY = 100;

/**
 * After an admin change to listings (D-145): only the pages that show them are rebuilt: each one's own page, its state
 * page (every state page for an all-India piece), Home and See all (the sitemap is CDN-kept a day, launch QA E-2d). Other product pages' Similar items
 * catch up within the day's fallback, as after a sale (engineering.md §Caching). Refreshing everything on every
 * edit rewrote all 5,852 product pages and the 2 MB state pages and used up Vercel's 200,000 page-cache writes
 * (2026-10-21). An edit to a listing customers don't see (a draft) refreshes nothing; `shownChanged` (published,
 * unpublished) refreshes its pages either way.
 */
export async function refreshListings(client: Client, ids: string[], shownChanged = false): Promise<void> {
  if (ids.length === 0) return;
  if (ids.length > MANY) {
    revalidateTag(STORE_TAG);
    return;
  }
  const pages = (await listListingPages(client, ids)).filter((p) => shownChanged || p.shown);
  if (pages.length === 0) return;
  revalidateTag(homeTag);
  revalidateTag(listingsTag);
  if (pages.some((p) => !p.region_slug)) revalidateTag(regionsTag);
  else for (const region of new Set(pages.map((p) => p.region_slug!))) revalidateTag(regionTag(region));
  for (const p of pages) revalidateTag(productTag(regionSegment(p.region_slug), p.slug));
}

/**
 * One listing's price, stock or reviews moved (D-189: a piece weighed at the hub, a quantity confirmed, a review): its
 * own page and its state's. Home and See all catch up within the day's fallback, and checkout charges the current price.
 * These happen many times a day, so none of them refreshes the whole store. An all-India piece leaves the 36 state pages
 * to the fallback too.
 */
export async function refreshProductPages(client: Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const pages = (await listListingPages(client, ids)).filter((p) => p.shown);
  for (const region of new Set(pages.flatMap((p) => (p.region_slug ? [p.region_slug] : [])))) {
    revalidateTag(regionTag(region));
  }
  for (const p of pages) revalidateTag(productTag(regionSegment(p.region_slug), p.slug));
}

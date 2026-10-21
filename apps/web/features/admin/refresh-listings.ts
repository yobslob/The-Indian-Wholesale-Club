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
 * page (every state page for an all-India piece), Home, See all and the sitemap. Other product pages' Similar items
 * catch up within the 5-minute fallback, as after a sale (engineering.md §Caching). Refreshing everything on every
 * edit rewrote all 5,852 product pages and the 2 MB state pages and used up Vercel's 200,000 page-cache writes
 * (2026-10-21). An edit to a listing customers don't see (a draft) refreshes nothing; `shownChanged` (published,
 * unpublished, Coming soon on or off) refreshes its pages either way.
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

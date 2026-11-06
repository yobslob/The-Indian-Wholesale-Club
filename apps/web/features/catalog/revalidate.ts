import 'server-only';

import { revalidateTag } from 'next/cache';

import { listOrderPages } from '@repo/db/server';
import { regionSegment } from '@repo/shared/domain';

import { homeTag, productTag, regionTag, STORE_TAG } from './data';

/** A product page, by the slugs its URL and cache entry use. */
export interface ProductPageRef {
  /** Null for an all-India piece (D-121): it sits on every state's page, which catch up within the day's fallback. */
  regionSlug: string | null;
  productSlug: string;
}

/**
 * After a sale (engineering.md §Caching): the pages whose stock numbers just moved are rebuilt on their next visit:
 * each product's page (pieces left, sold out), its region page (cards, Leaving soon, Most wanted) and Home (Just
 * listed). See all pages carry no stock and stay cached; Similar items on other product pages catch up within the
 * day's fallback (their Add is re-checked at checkout anyway). Without refs (an old stored checkout) everything.
 */
export function revalidateAfterSale(pages: ProductPageRef[]): void {
  if (pages.length === 0) {
    revalidateTag(STORE_TAG);
    return;
  }
  revalidateTag(homeTag);
  for (const regionSlug of new Set(pages.map((p) => p.regionSlug))) {
    if (regionSlug) revalidateTag(regionTag(regionSlug));
  }
  for (const p of pages) revalidateTag(productTag(regionSegment(p.regionSlug), p.productSlug));
}

/**
 * An order's pieces went back to stock (a cancel, D-189): the same pages as its sale. The money has already moved, so a
 * failed read refreshes everything rather than failing the cancel.
 */
export async function revalidateOrderPieces(client: Parameters<typeof listOrderPages>[0], orderId: string): Promise<void> {
  revalidateAfterSale(await listOrderPages(client, orderId).catch(() => []));
}

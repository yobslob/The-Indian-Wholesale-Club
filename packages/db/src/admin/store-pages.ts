import { unwrap, type IwcClient } from '../client';

/** Where a listing shows in the store: its page's slugs (region null = an all-India piece, D-121). */
export interface ListingPage {
  slug: string;
  region_slug: string | null;
  /** Customers see it: live (D-187, Y-9: a coming-soon piece is on no store page). */
  shown: boolean;
}

/** The listings these pickups are for (D-189: weighing or losing a piece moves only that listing's pages). */
export async function listPickupProductIds(client: IwcClient, pickupIds: string[]): Promise<string[]> {
  if (pickupIds.length === 0) return [];
  const rows = unwrap(
    await client.from('pickups').select('variant:product_variants(product_id)').in('id', pickupIds),
  );
  return [...new Set(rows.flatMap((r) => (r.variant ? [r.variant.product_id] : [])))];
}

/** The store pages of these listings, for refreshing only them after an admin change (D-145). */
export async function listListingPages(client: IwcClient, ids: string[]): Promise<ListingPage[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(
    await client.from('products').select('slug, status, region:regions(slug)').in('id', ids),
  );
  return rows.map((r) => ({
    slug: r.slug,
    region_slug: r.region?.slug ?? null,
    shown: r.status === 'live',
  }));
}

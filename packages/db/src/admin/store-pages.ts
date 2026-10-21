import { unwrap, type IwcClient } from '../client';

/** Where a listing shows in the store: its page's slugs (region null = an all-India piece, D-121). */
export interface ListingPage {
  slug: string;
  region_slug: string | null;
  /** Customers see it: live, or archived and shown as Coming soon (D-135). */
  shown: boolean;
}

/** The store pages of these listings, for refreshing only them after an admin change (D-145). */
export async function listListingPages(client: IwcClient, ids: string[]): Promise<ListingPage[]> {
  if (ids.length === 0) return [];
  const rows = unwrap(
    await client.from('products').select('slug, status, coming_soon, region:regions(slug)').in('id', ids),
  );
  return rows.map((r) => ({
    slug: r.slug,
    region_slug: r.region?.slug ?? null,
    shown: r.status === 'live' || r.coming_soon,
  }));
}

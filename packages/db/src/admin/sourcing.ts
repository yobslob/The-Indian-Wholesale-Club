import { unwrap, unwrapPage, type Enum, type IwcClient, type Update } from '../client';

/**
 * Listings imported from online shops (D-110). Admin only: the source columns never reach a store_* view (D-003).
 */

const SOURCED_COLUMNS = `id, slug, name, status, product_type, price_cents, shop_price_paise, source_url, source_site,
  source_checked_at, source_in_stock, region:regions(slug, name),
  variants:product_variants(id, label, options, qty_listed, qty_reserved, sort_order, is_active, weight_g),
  media:product_media(id, storage_path, is_primary, sort_order)`;

/** The listing made from this source page earlier, or null. */
export async function getSourcedProduct(client: IwcClient, sourceUrl: string) {
  return unwrap(
    await client.from('products').select(SOURCED_COLUMNS).eq('source_url', sourceUrl).maybeSingle(),
  );
}

export const SOURCED_SORTS = ['checked', 'newest', 'name', 'price-desc'] as const;
export type SourcedSort = (typeof SOURCED_SORTS)[number];

export interface SourcedFilter {
  search?: string;
  /** The shop's site, e.g. myntra.com. */
  site?: string;
  regionId?: string;
  /** All-India listings only (D-121). */
  noRegion?: boolean;
  productType?: Enum<'product_type'>;
  status?: Enum<'product_status'>;
  /** Only listings whose price was last checked before this time (ISO). */
  checkedBefore?: string;
  /** The price checked longest ago first unless chosen. */
  sort?: SourcedSort;
  offset?: number;
  limit?: number;
}

/**
 * A page of imported listings (not archived) and how many match in all (D-140: the list used to stop at 100 while
 * its heading said 100).
 */
export async function pageSourcedProducts(client: IwcClient, filter: SourcedFilter = {}) {
  let query = client
    .from('products')
    .select(SOURCED_COLUMNS, { count: 'exact' })
    .not('source_url', 'is', null)
    .neq('status', 'archived');
  if (filter.site) query = query.eq('source_site', filter.site);
  if (filter.regionId) query = query.eq('region_id', filter.regionId);
  if (filter.noRegion) query = query.is('region_id', null);
  if (filter.productType) query = query.eq('product_type', filter.productType);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.checkedBefore) query = query.or(`source_checked_at.is.null,source_checked_at.lt.${filter.checkedBefore}`);
  if (filter.search?.trim()) query = query.textSearch('search', filter.search.trim(), { type: 'websearch', config: 'simple' });
  const ordered =
    filter.sort === 'newest'
      ? query.order('created_at', { ascending: false })
      : filter.sort === 'name'
        ? query.order('name')
        : filter.sort === 'price-desc'
          ? query.order('price_cents', { ascending: false })
          : query.order('source_checked_at', { ascending: true, nullsFirst: true });
  const offset = filter.offset ?? 0;
  return unwrapPage(await ordered.order('id').range(offset, offset + (filter.limit ?? 50) - 1));
}

/** The shops imported listings come from (the Imported tab's Shop filter). */
export async function listSourcedSites(client: IwcClient): Promise<string[]> {
  const rows = unwrap(await client.from('sourcing_shops').select('site').order('site'));
  return rows.map((r) => r.site);
}

export async function updateSourcedProduct(
  client: IwcClient,
  id: string,
  patch: Pick<
    Update<'products'>,
    | 'source_url'
    | 'source_site'
    | 'source_checked_at'
    | 'source_in_stock'
    | 'shop_price_paise'
    | 'description'
    | 'name'
    | 'summary'
    | 'attributes'
    | 'price_auto'
    | 'wears'
  >,
) {
  unwrap(await client.from('products').update(patch).eq('id', id));
}

/**
 * The vendor that stands for an online shop in one state, or for all India (D-121) (pickups and the cycle's shop cards
 * group by it), made the first time a product of that shop and state is imported.
 */
export async function onlineVendorFor(
  client: IwcClient,
  site: string,
  label: string,
  /** Null: the shop's vendor for all-India listings (D-121). */
  regionId: string | null,
  userId: string,
): Promise<string> {
  const query = client.from('vendors').select('id, status').eq('online_site', site);
  const found = unwrap(
    await (regionId ? query.eq('region_id', regionId) : query.is('region_id', null)).maybeSingle(),
  );
  if (found) {
    if (found.status !== 'active')
      unwrap(await client.from('vendors').update({ status: 'active' }).eq('id', found.id));
    return found.id;
  }
  const made = unwrap(
    await client
      .from('vendors')
      .insert({
        shop_name: `${label} (online)`,
        online_site: site,
        region_id: regionId,
        status: 'active',
        notes: `Online shop (D-110): its listings are imported from ${site}. A sold piece is ordered there, to the hub.`,
        onboarded_at: new Date().toISOString(),
        onboarded_by: userId,
      })
      .select('id')
      .single(),
  );
  return made.id;
}

/** Removes a product's photo rows and returns their files (the caller deletes them from storage). */
export async function removeProductMedia(client: IwcClient, productId: string): Promise<string[]> {
  const rows = unwrap(
    await client.from('product_media').delete().eq('product_id', productId).select('storage_path'),
  );
  return rows.map((r) => r.storage_path);
}

/**
 * The shop items an imported listing's variants are ordered as (D-118), so the weekly check covers listings imported
 * by hand too: each variant's item is updated when known (by the shop's id, else by the variant), added otherwise, and
 * becomes the variant's source when it has none. An item another listing already follows is left to that listing.
 */
export async function syncImportSources(
  client: IwcClient,
  productId: string,
  site: string,
  pageUrl: string,
  items: {
    variantId: string;
    key: string | null;
    url: string;
    pricePaise: number;
    inStock: boolean;
  }[],
) {
  const existing = unwrap(
    await client
      .from('product_sources')
      .select('id, variant_id, item_key')
      .eq('product_id', productId)
      .eq('site', site),
  );
  const checkedAt = new Date().toISOString();
  for (const item of items) {
    const hit = existing.find(
      (e) => (item.key && e.item_key === item.key) || e.variant_id === item.variantId,
    );
    const fields = {
      page_url: pageUrl,
      item_url: item.url,
      price_paise: item.pricePaise,
      in_stock: item.inStock,
      checked_at: checkedAt,
      fail_count: 0,
      last_error: null,
    };
    const { data, error } = hit
      ? await client
          .from('product_sources')
          .update({ ...fields, ...(item.key ? { item_key: item.key } : {}) })
          .eq('id', hit.id)
          .select('id')
          .single()
      : await client
          .from('product_sources')
          .insert({
            ...fields,
            product_id: productId,
            variant_id: item.variantId,
            site,
            item_key: item.key,
          })
          .select('id')
          .single();
    if (error || !data) continue; // that item is another listing's (one listing per shop item)
    unwrap(
      await client
        .from('product_variants')
        .update({ source_id: data.id })
        .eq('id', item.variantId)
        .is('source_id', null),
    );
  }
}

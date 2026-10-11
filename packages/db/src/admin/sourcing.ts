import { unwrap, type IwcClient, type Update } from '../client';

/**
 * Listings imported from online shops (D-110). Admin only: the source columns never reach a store_* view (D-003).
 */

const SOURCED_COLUMNS = `id, slug, name, status, product_type, price_cents, shop_price_paise, source_url, source_site,
  source_checked_at, source_in_stock, region:regions(slug, name),
  variants:product_variants(id, label, options, qty_listed, qty_reserved, sort_order, is_active),
  media:product_media(id, storage_path, is_primary, sort_order)`;

/** The listing made from this source page earlier, or null. */
export async function getSourcedProduct(client: IwcClient, sourceUrl: string) {
  return unwrap(
    await client.from('products').select(SOURCED_COLUMNS).eq('source_url', sourceUrl).maybeSingle(),
  );
}

/** Every imported listing, the one checked longest ago first (the importer's "check prices" list). */
export async function listSourcedProducts(client: IwcClient, limit = 100) {
  return unwrap(
    await client
      .from('products')
      .select(SOURCED_COLUMNS)
      .not('source_url', 'is', null)
      .neq('status', 'archived')
      .order('source_checked_at', { ascending: true, nullsFirst: true })
      .limit(limit),
  );
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
  >,
) {
  unwrap(await client.from('products').update(patch).eq('id', id));
}

/**
 * The vendor that stands for an online shop in one state (pickups and the cycle's shop cards group by it), made the
 * first time a product of that shop and state is imported.
 */
export async function onlineVendorFor(
  client: IwcClient,
  site: string,
  label: string,
  regionId: string,
  userId: string,
): Promise<string> {
  const found = unwrap(
    await client
      .from('vendors')
      .select('id, status')
      .eq('online_site', site)
      .eq('region_id', regionId)
      .maybeSingle(),
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

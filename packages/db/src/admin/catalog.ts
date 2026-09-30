import { unwrap, type Enum, type Insert, type IwcClient, type Update } from '../client';

// ---------------------------------------------------------------- vendors (D-003: admin only)

const VENDOR_COLUMNS = `id, shop_name, owner_name, phone, whatsapp, email, address, town, region_id, payment_method, payment_reference,
  licences, status, notes, photo_path, is_placeholder, onboarded_at, created_at, updated_at, region:regions(slug, name)`;

export interface VendorFilter {
  regionId?: string;
  status?: Enum<'vendor_status'>;
}

export async function listVendors(client: IwcClient, filter: VendorFilter = {}) {
  let query = client.from('vendors').select(VENDOR_COLUMNS);
  if (filter.regionId) query = query.eq('region_id', filter.regionId);
  if (filter.status) query = query.eq('status', filter.status);
  return unwrap(await query.order('shop_name'));
}

export async function getVendor(client: IwcClient, id: string) {
  return unwrap(await client.from('vendors').select(VENDOR_COLUMNS).eq('id', id).maybeSingle());
}

export async function createVendor(client: IwcClient, input: Insert<'vendors'>) {
  return unwrap(await client.from('vendors').insert(input).select('id').single());
}

export async function updateVendor(client: IwcClient, id: string, patch: Update<'vendors'>) {
  unwrap(await client.from('vendors').update(patch).eq('id', id));
}

// ---------------------------------------------------------------- regions + categories

export async function listRegionsAdmin(client: IwcClient) {
  return unwrap(
    await client
      .from('regions')
      .select(
        `id, slug, name, sort_order, is_live, greeting_native, greeting_script, greeting_latin, greeting_meaning,
          languages, tagline, story, hero_image_path, accent_color, content_status, updated_at`,
      )
      .order('sort_order'),
  );
}

/** One region for its admin edit page; null when the id does not exist. */
export async function getRegionAdmin(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('regions')
      .select(
        `id, slug, name, sort_order, is_live, greeting_native, greeting_script, greeting_latin, greeting_meaning,
          languages, tagline, story, hero_image_path, accent_color, content_status, updated_at`,
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function updateRegion(client: IwcClient, id: string, patch: Update<'regions'>) {
  unwrap(await client.from('regions').update(patch).eq('id', id));
}

/** D-019: Claude-drafted region text becomes visible only after the founder approves it. */
export async function approveRegionContent(client: IwcClient, id: string) {
  unwrap(await client.from('regions').update({ content_status: 'approved' }).eq('id', id));
}

export async function listCategories(client: IwcClient) {
  return unwrap(
    await client
      .from('categories')
      .select('id, product_type, slug, name, parent_id, sort_order, is_active')
      .order('product_type')
      .order('sort_order'),
  );
}

export async function createCategory(client: IwcClient, input: Insert<'categories'>) {
  return unwrap(await client.from('categories').insert(input).select('id').single());
}

export async function updateCategory(client: IwcClient, id: string, patch: Update<'categories'>) {
  unwrap(await client.from('categories').update(patch).eq('id', id));
}

// ---------------------------------------------------------------- products + variants

const PRODUCT_LIST_COLUMNS = `id, slug, name, product_type, status, price_cents, shop_price_paise, is_placeholder, updated_at,
  region:regions(slug, name), vendor:vendors(id, shop_name),
  variants:product_variants(id, label, qty_listed, qty_reserved, qty_confirmed_at, is_active)`;

export interface AdminProductFilter {
  status?: Enum<'product_status'>;
  productType?: Enum<'product_type'>;
  regionId?: string;
  vendorId?: string;
  search?: string;
  limit?: number;
}

export async function listAdminProducts(client: IwcClient, filter: AdminProductFilter = {}) {
  let query = client.from('products').select(PRODUCT_LIST_COLUMNS);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.productType) query = query.eq('product_type', filter.productType);
  if (filter.regionId) query = query.eq('region_id', filter.regionId);
  if (filter.vendorId) query = query.eq('vendor_id', filter.vendorId);
  if (filter.search && filter.search.trim()) {
    query = query.textSearch('search', filter.search.trim(), {
      type: 'websearch',
      config: 'simple',
    });
  }
  return unwrap(await query.order('updated_at', { ascending: false }).limit(filter.limit ?? 100));
}

export async function getAdminProduct(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('products')
      .select(
        `id, slug, name, product_type, region_id, category_id, vendor_id, summary, description, story, craft, attributes,
          price_cents, shop_price_paise, origin_town, has_origin_label, status, is_placeholder, published_at, is_curated,
          created_at, updated_at,
          variants:product_variants(id, sku, label, options, price_cents, weight_g, qty_listed, qty_reserved,
          qty_confirmed_at, is_active, sort_order),
          media:product_media(id, variant_id, storage_path, alt_text, sort_order, is_primary)`,
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function createProduct(client: IwcClient, input: Insert<'products'>) {
  return unwrap(await client.from('products').insert(input).select('id').single());
}

export async function updateProduct(client: IwcClient, id: string, patch: Update<'products'>) {
  unwrap(await client.from('products').update(patch).eq('id', id));
}

/** Publishing stamps published_at the first time. The DB refuses live spices (D-032). */
export async function setProductStatus(
  client: IwcClient,
  id: string,
  status: Enum<'product_status'>,
) {
  const patch: Update<'products'> = { status };
  if (status === 'live') patch.published_at = new Date().toISOString();
  unwrap(await client.from('products').update(patch).eq('id', id));
}

/** New variant; an initial qty_listed is logged as 'listed' in the stock ledger. */
export async function createVariant(client: IwcClient, input: Insert<'product_variants'>) {
  return unwrap(await client.from('product_variants').insert(input).select('id').single());
}

/** Everything except quantities (those go through setListedQty / order functions, INV-3/4). */
export type VariantPatch = Omit<
  Update<'product_variants'>,
  'qty_listed' | 'qty_reserved' | 'id' | 'product_id'
>;

export async function updateVariant(client: IwcClient, id: string, patch: VariantPatch) {
  unwrap(await client.from('product_variants').update(patch).eq('id', id));
}

/** Admin stock correction with a ledger note; also records it as re-confirmed with the shop. */
export async function setListedQty(
  client: IwcClient,
  variantId: string,
  qtyListed: number,
  note?: string,
) {
  unwrap(
    await client.rpc('admin_set_listed_qty', {
      p_variant: variantId,
      p_qty_listed: qtyListed,
      ...(note ? { p_note: note } : {}),
    }),
  );
}

export async function listStockMovements(client: IwcClient, variantId: string, limit = 50) {
  return unwrap(
    await client
      .from('stock_movements')
      .select('id, reason, delta_listed, delta_reserved, ref_type, ref_id, actor, note, created_at')
      .eq('variant_id', variantId)
      .order('id', { ascending: false })
      .limit(limit),
  );
}

export async function addProductMedia(client: IwcClient, input: Insert<'product_media'>) {
  return unwrap(await client.from('product_media').insert(input).select('id').single());
}

export async function deleteProductMedia(client: IwcClient, id: string) {
  unwrap(await client.from('product_media').delete().eq('id', id));
}

/** One photo row (to find its file before removing it). */
export async function getProductMedia(client: IwcClient, id: string) {
  return unwrap(
    await client.from('product_media').select('id, product_id, storage_path, is_primary').eq('id', id).maybeSingle(),
  );
}

/** Makes one photo the product's main photo (the database allows one per product, so the old one goes first). */
export async function setPrimaryProductMedia(client: IwcClient, productId: string, mediaId: string) {
  unwrap(await client.from('product_media').update({ is_primary: false }).eq('product_id', productId).eq('is_primary', true));
  unwrap(await client.from('product_media').update({ is_primary: true }).eq('id', mediaId).eq('product_id', productId));
}

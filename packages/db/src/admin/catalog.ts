import { listingInputSchema, type ListingInput, type WeightSource } from '@repo/shared/domain';

import { unwrap, unwrapPage, type Enum, type Insert, type IwcClient, type Update } from '../client';

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

/** The region album (D-051): its photos in order. */
export async function listRegionPhotos(client: IwcClient, regionId: string) {
  return unwrap(
    await client
      .from('region_photos')
      .select('id, storage_path, alt_text, sort_order, created_at')
      .eq('region_id', regionId)
      .order('sort_order')
      .order('created_at'),
  );
}

/** Adds a photo at the end of the album. */
export async function addRegionPhoto(client: IwcClient, regionId: string, storagePath: string, altText: string) {
  const last = unwrap(
    await client.from('region_photos').select('sort_order').eq('region_id', regionId).order('sort_order', { ascending: false }).limit(1),
  );
  unwrap(
    await client.from('region_photos').insert({
      region_id: regionId,
      storage_path: storagePath,
      alt_text: altText,
      sort_order: (last[0]?.sort_order ?? 0) + 1,
    }),
  );
}

/** Removes an album photo and returns its storage path (the caller deletes the file). */
export async function removeRegionPhoto(client: IwcClient, photoId: string): Promise<string | null> {
  const rows = unwrap(await client.from('region_photos').delete().eq('id', photoId).select('storage_path'));
  return rows[0]?.storage_path ?? null;
}

/** D-019: Claude-drafted region text becomes visible only after the founder approves it. */
export async function approveRegionContent(client: IwcClient, id: string) {
  unwrap(await client.from('regions').update({ content_status: 'approved' }).eq('id', id));
}

export async function listCategories(client: IwcClient) {
  return unwrap(
    await client
      .from('categories')
      .select('id, product_type, slug, name, parent_id, sort_order, is_active, default_weight_g, tax_class')
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

const PRODUCT_LIST_COLUMNS = `id, slug, name, product_type, status, coming_soon, price_cents, shop_price_paise, is_placeholder, is_us_stock, updated_at, wears,
  region:regions(slug, name), vendor:vendors(id, shop_name),
  variants:product_variants(id, label, qty_listed, qty_reserved, qty_confirmed_at, is_active, weight_g, weight_source),
  category:categories(default_weight_g),
  media:product_media(storage_path, is_primary, sort_order)`;

export const ADMIN_PRODUCT_SORTS = ['updated', 'newest', 'price-asc', 'price-desc', 'name'] as const;
export type AdminProductSort = (typeof ADMIN_PRODUCT_SORTS)[number];

export interface AdminProductFilter {
  status?: Enum<'product_status'>;
  productType?: Enum<'product_type'>;
  regionId?: string;
  /** D-136: all-India listings only (no state). */
  noRegion?: boolean;
  categoryId?: string;
  vendorId?: string;
  /** D-136: the customer price range, in cents. */
  minCents?: number;
  maxCents?: number;
  /** D-136: recently updated first unless chosen. */
  sort?: AdminProductSort;
  /** D-072: US clearance pieces only. */
  usStock?: boolean;
  /** D-140: who it is for; 'none' = clothing without it. */
  wears?: 'women' | 'men' | 'kids' | 'unisex' | 'none';
  search?: string;
  limit?: number;
  /** Skip this many (the next page). */
  offset?: number;
}

function adminProductQuery(client: IwcClient, filter: AdminProductFilter, count: boolean) {
  let query = client.from('products').select(PRODUCT_LIST_COLUMNS, count ? { count: 'exact' } : undefined);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.productType) query = query.eq('product_type', filter.productType);
  if (filter.regionId) query = query.eq('region_id', filter.regionId);
  if (filter.noRegion) query = query.is('region_id', null);
  if (filter.categoryId) query = query.eq('category_id', filter.categoryId);
  if (filter.vendorId) query = query.eq('vendor_id', filter.vendorId);
  if (filter.minCents !== undefined) query = query.gte('price_cents', filter.minCents);
  if (filter.maxCents !== undefined) query = query.lte('price_cents', filter.maxCents);
  if (filter.usStock) query = query.eq('is_us_stock', true);
  if (filter.wears === 'none') query = query.eq('product_type', 'clothing').is('wears', null);
  else if (filter.wears) query = query.eq('wears', filter.wears);
  if (filter.search && filter.search.trim()) {
    query = query.textSearch('search', filter.search.trim(), {
      type: 'websearch',
      config: 'simple',
    });
  }
  const limit = filter.limit ?? 100;
  const offset = filter.offset ?? 0;
  const [column, ascending] = (
    {
      updated: ['updated_at', false],
      newest: ['created_at', false],
      'price-asc': ['price_cents', true],
      'price-desc': ['price_cents', false],
      name: ['name', true],
    } as const
  )[filter.sort ?? 'updated'];
  // id breaks ties so pages never repeat or skip a product
  return query.order(column, { ascending }).order('id').range(offset, offset + limit - 1);
}

export async function listAdminProducts(client: IwcClient, filter: AdminProductFilter = {}) {
  return unwrap(await adminProductQuery(client, filter, false));
}

/** A page of products and how many match the filters in all (the pager's "1–50 of 3,412", D-140). */
export async function pageAdminProducts(client: IwcClient, filter: AdminProductFilter = {}) {
  return unwrapPage(await adminProductQuery(client, filter, true));
}

/** How many products are in each status: the Listings tabs' counts (D-096). */
export async function countProductsByStatus(client: IwcClient): Promise<Record<Enum<'product_status'>, number>> {
  const head = { count: 'exact', head: true } as const;
  const statuses = ['draft', 'live', 'paused', 'archived'] as const;
  const counts = await Promise.all(statuses.map((s) => client.from('products').select('id', head).eq('status', s)));
  return Object.fromEntries(
    statuses.map((s, i) => {
      if (counts[i]!.error) throw new Error(counts[i]!.error!.message);
      return [s, counts[i]!.count ?? 0];
    }),
  ) as Record<Enum<'product_status'>, number>;
}

export async function getAdminProduct(client: IwcClient, id: string) {
  return unwrap(
    await client
      .from('products')
      .select(
        `id, slug, name, product_type, region_id, category_id, vendor_id, summary, description, story, craft, attributes,
          price_cents, price_auto, shop_price_paise, origin_town, has_origin_label, status, coming_soon, coming_soon_note, is_placeholder, published_at, is_curated,
          source_url, source_site, source_checked_at,
          created_at, updated_at,
          variants:product_variants!product_variants_product_id_fkey(id, sku, label, options, price_cents, weight_g,
          weight_source, weight_note, weight_estimate_g, weight_estimate_note, qty_listed, qty_reserved, qty_confirmed_at,
          is_active, sort_order, shop_price_paise, source_id),
          category:categories(name, default_weight_g),
          media:product_media(id, variant_id, storage_path, alt_text, sort_order, is_primary)`,
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

/**
 * A new listing (flows.md §2, C3): the draft product and its variants in one database transaction
 * (admin_create_listing), checked against the shared schema first. Returns the product id; photos go on after.
 */
export async function createListing(client: IwcClient, input: ListingInput): Promise<string> {
  const listing = listingInputSchema.parse(input);
  const id = unwrap(await client.rpc('admin_create_listing', { p_listing: listing }));
  if (typeof id !== 'string') throw new Error('the listing was not created');
  // D-140: who it is for, when the admin chose it (the database fills it from the name otherwise)
  if (listing.product_type === 'clothing' && listing.wears)
    unwrap(await client.from('products').update({ wears: listing.wears }).eq('id', id));
  return id;
}

/** Live variants whose quantity is due a re-check with the shop (pricing_settings.stale_listing_days). */
export async function listStaleVariants(client: IwcClient) {
  return unwrap(await client.rpc('admin_stale_variants', undefined, { get: true }));
}

export async function createProduct(client: IwcClient, input: Insert<'products'>) {
  return unwrap(await client.from('products').insert(input).select('id').single());
}

export async function updateProduct(client: IwcClient, id: string, patch: Update<'products'>) {
  unwrap(await client.from('products').update(patch).eq('id', id));
}

/** Publishing stamps published_at the first time. The DB refuses live food until it is cleared (D-074). */
export async function setProductStatus(
  client: IwcClient,
  id: string,
  status: Enum<'product_status'>,
) {
  const patch: Update<'products'> = { status };
  if (status === 'live') patch.published_at = new Date().toISOString();
  unwrap(await client.from('products').update(patch).eq('id', id));
}

export interface PublishDraftsResult {
  published: number;
  no_photo: number;
  no_option: number;
  no_stock: number;
  /** D-129: an option without a weight (its price would rest on a guess). */
  no_weight: number;
  refused: number;
  note: string | null;
  /** Published without every detail customers see (fibre and care, ingredients and allergens, material). */
  live_missing_details: number;
}

/** Every draft that is ready goes live, each on its own (D-120); the rest are counted by what they lack. */
export async function publishDrafts(client: IwcClient): Promise<PublishDraftsResult> {
  return unwrap(await client.rpc('admin_publish_drafts')) as unknown as PublishDraftsResult;
}

/**
 * D-128: Products → Download Excel: one row per product in the page's view (status tab, US clearance, search) with the
 * shop price and weight that gave it its price, and the price.
 */
export async function listPriceSheet(
  client: IwcClient,
  filter: AdminProductFilter = {}, // the order, limit and offset are the sheet's own
) {
  return unwrap(
    await client.rpc('admin_price_sheet', {
      ...(filter.status ? { p_status: filter.status } : {}),
      p_us_stock: filter.usStock ?? false,
      ...(filter.search?.trim() ? { p_search: filter.search.trim() } : {}),
      // D-136: the Products page's filters
      ...(filter.productType ? { p_type: filter.productType } : {}),
      ...(filter.regionId ? { p_region: filter.regionId } : {}),
      ...(filter.noRegion ? { p_no_region: true } : {}),
      ...(filter.categoryId ? { p_category: filter.categoryId } : {}),
      ...(filter.vendorId ? { p_vendor: filter.vendorId } : {}),
      ...(filter.minCents !== undefined ? { p_min_cents: filter.minCents } : {}),
      ...(filter.maxCents !== undefined ? { p_max_cents: filter.maxCents } : {}),
    }),
  );
}

export interface WeightToCheck {
  id: string;
  name: string;
  status: Enum<'product_status'>;
  product_type: Enum<'product_type'>;
  category: string;
  category_weight_g: number | null;
  variants: {
    id: string;
    label: string;
    options: Record<string, string>;
    is_active: boolean;
    weight_g: number | null;
    weight_source: WeightSource | null;
    weight_note: string | null;
    shop_price_paise: number | null;
    /** D-131: the weight estimator's latest weight and how it got there. */
    weight_estimate_g: number | null;
    weight_estimate_note: string | null;
  }[];
}

/**
 * D-129: Products → Weights to check: listings with an option that has no weight, one from a matching item, one
 * recorded before sources were kept, an unusual one for its category, or a shop's weight the estimator doubts
 * (D-131); live ones first, missing first.
 */
export async function listWeightsToCheck(
  client: IwcClient,
  offset = 0,
  limit = 50,
): Promise<{ total: number; missing: number; rows: WeightToCheck[] }> {
  return unwrap(
    await client.rpc('admin_weights_to_check', { p_offset: offset, p_limit: limit }),
  ) as unknown as { total: number; missing: number; rows: WeightToCheck[] };
}

/**
 * An option's weight and where it came from (D-129). The database reprices the listing from it (D-128) and lets a
 * held option sell again.
 */
export async function setVariantWeight(
  client: IwcClient,
  variantId: string,
  weight: { grams: number; source: 'weighed' | 'admin'; note: string | null },
) {
  unwrap(
    await client
      .from('product_variants')
      .update({ weight_g: weight.grams, weight_source: weight.source, weight_note: weight.note })
      .eq('id', variantId),
  );
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

/** D-140: who a clothing piece is for, set by an admin (null clears it; a live piece then keeps its value). */
export async function setProductWears(client: IwcClient, id: string, wears: 'women' | 'men' | 'kids' | 'unisex') {
  unwrap(await client.from('products').update({ wears }).eq('id', id));
}

/** D-140 (L1): every imported clothing and home listing's name with its shop, for the names-to-tidy review (1,000 at a time). */
export async function listNamesToReview(client: IwcClient) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const rows = unwrap(
      await client
        .from('products')
        .select('id, name, product_type, status, vendor_id, source_site, shop_title')
        .in('product_type', ['clothing', 'home'])
        // only names that came from a shop's page; names written for IWC are left alone
        .not('source_url', 'is', null)
        .neq('status', 'archived')
        .order('created_at')
        .order('id')
        .range(from, from + 999),
    );
    all.push(...rows);
    if (rows.length < 1000) return all;
  }
}

/** D-140 (L1): new names for listings; the old one is kept as the shop's title when none was kept yet. */
export async function renameListings(client: IwcClient, items: { id: string; name: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  const current = unwrap(await client.from('products').select('id, name, shop_title').in('id', items.map((i) => i.id)));
  let n = 0;
  for (const item of items) {
    const row = current.find((r) => r.id === item.id);
    if (!row || row.name === item.name) continue;
    unwrap(
      await client
        .from('products')
        .update({ name: item.name, shop_title: row.shop_title ?? row.name.slice(0, 300) })
        .eq('id', item.id),
    );
    n += 1;
  }
  return n;
}

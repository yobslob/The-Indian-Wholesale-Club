/**
 * Customer-safe reads. ONLY store_* views/functions are used here (D-017), and
 * every payload is validated by the zod schemas in ./schemas.
 * Customer code (storefront, customer app screens) imports from '@repo/db/store' only.
 */
import { z } from 'zod';

import { withLookPhotos, type HeavyShipping, type ProductType, type SmallOrderCharges } from '@repo/shared/domain';

import { unwrap, type IwcClient } from '../client';

import {
  browsePageSchema,
  cardOptionSchema,
  homeSchema,
  orderDetailSchema,
  orderSummarySchema,
  productCardSchema,
  productPageSchema,
  regionHeadSchema,
  regionPageSchema,
  storePolicySchema,
  type BrowsePage,
  type CardOption,
  type HomeData,
  type OrderDetail,
  type OrderSummary,
  type ProductCard,
  type ProductPage,
  type RegionHead,
  type RegionPage,
  type StorePolicy,
  type TypeRow,
  typeRowSchema,
} from './schemas';

export * from './schemas';
export * from './search';

/** Home + /states: all 36 regions, the tiles and Home's rows (1 round trip). */
export async function getHome(client: IwcClient): Promise<HomeData> {
  const data = unwrap(await client.rpc('store_home', undefined, { get: true }));
  return homeSchema.parse(data);
}

/** /states/[region]: null when the region slug does not exist (1 round trip). */
export async function getRegionPage(
  client: IwcClient,
  regionSlug: string,
): Promise<RegionPage | null> {
  const data = unwrap(
    await client.rpc('store_region_page', { p_region_slug: regionSlug }, { get: true }),
  );
  return data === null ? null : regionPageSchema.parse(data);
}

/**
 * D-157: /states/[region]'s head, without the card lists: null when the slug does not exist (1 round trip). Until
 * migration 20261029090000 is applied (PostgREST: no such function) it is cut from store_region_page() as before.
 */
export async function getRegionHead(client: IwcClient, regionSlug: string): Promise<RegionHead | null> {
  const res = await client.rpc('store_region_head', { p_region_slug: regionSlug }, { get: true });
  if (res.error?.code === 'PGRST202' || res.error?.code === '42883') {
    const page = await getRegionPage(client, regionSlug);
    if (!page) return null;
    const count = (t: string): number =>
      page.category_counts.filter((c) => c.product_type === t).reduce((n, c) => n + c.count, 0);
    return {
      region: page.region,
      album: page.album,
      most_wanted: page.most_wanted,
      curated: page.curated,
      type_counts: { clothing: count('clothing'), food: count('food'), home: count('home') },
    };
  }
  const data = unwrap(res);
  return data === null ? null : regionHeadSchema.parse(data);
}

/** /states/[region]/[product]: null when not found or not live (1 round trip). */
export async function getProductPage(
  client: IwcClient,
  regionSlug: string,
  productSlug: string,
): Promise<ProductPage | null> {
  const data = unwrap(
    await client.rpc(
      'store_product_page',
      {
        p_region_slug: regionSlug,
        p_product_slug: productSlug,
      },
      { get: true },
    ),
  );
  return data === null ? null : productPageSchema.parse(data);
}

const PRODUCT_CARD_COLUMNS =
  'id, slug, name, product_type, region_slug, region_name, category_slug, category_name, price_cents, primary_image_path';

/** D-191: 'popular' is the default. 'low' stays for an older app (cheapest first; on Clothing one of each, D-144). */
export const BROWSE_SORTS = ['popular', 'low', 'new', 'price-asc', 'price-desc'] as const;
export type BrowseSort = (typeof BROWSE_SORTS)[number];

export interface BrowseFilter {
  productType: ProductType;
  regionSlug?: string;
  categorySlug?: string;
  /** D-191: a sub-category. */
  subSlug?: string;
  /** D-136: the card price range, in cents (pieces without a shown price drop out). */
  minCents?: number;
  maxCents?: number;
  /** D-136: option values (size, or food's pack); a piece matches when any of its options is one. */
  sizes?: string[];
  /** D-136: newest first when absent (an older app); D-191: the website and the app send 'popular'. */
  sort?: BrowseSort;
  /** D-140: clothing for women or men (unisex pieces show under both). */
  forWho?: 'women' | 'men';
  /** Skip this many (the next page of a See all list). */
  offset?: number;
  /** At most 500 (the database caps it). */
  limit?: number;
}

/**
 * See all (website /clothing and /food, the app's Browse; D-062, D-067): one page of light cards newest first, the
 * total, and the per-state and per-category counts for the filters, in one round trip (store_browse).
 */
export async function browseProducts(client: IwcClient, filter: BrowseFilter): Promise<BrowsePage> {
  const data = unwrap(
    await client.rpc(
      'store_browse',
      {
        p_type: filter.productType,
        ...(filter.regionSlug ? { p_region: filter.regionSlug } : {}),
        ...(filter.categorySlug ? { p_category: filter.categorySlug } : {}),
        ...(filter.subSlug ? { p_sub: filter.subSlug } : {}),
        ...(filter.minCents !== undefined ? { p_min_cents: filter.minCents } : {}),
        ...(filter.maxCents !== undefined ? { p_max_cents: filter.maxCents } : {}),
        ...(filter.sizes?.length ? { p_sizes: filter.sizes.join('|') } : {}),
        ...(filter.sort && filter.sort !== 'new' ? { p_sort: filter.sort } : {}),
        ...(filter.forWho ? { p_for: filter.forWho } : {}),
        p_offset: filter.offset ?? 0,
        p_limit: filter.limit ?? 24,
      },
      { get: true },
    ),
  );
  return browsePageSchema.parse(data);
}

/**
 * Search (website and app): product cards a page at a time (D-067) through store_search, which also records the words
 * and the number of matches for the admin's Insights (no user, no address). `record: false` for a re-read of results
 * already counted (the website's "Show more" reads from the first result again).
 */
export async function searchProducts(
  client: IwcClient,
  query: string,
  page: { offset?: number; limit?: number; record?: boolean } = {},
): Promise<ProductCard[]> {
  const data = unwrap(
    await client
      .rpc('store_search', {
        p_query: query,
        p_offset: page.offset ?? 0,
        p_limit: page.limit ?? 24,
        p_record: page.record ?? true,
      })
      .select(PRODUCT_CARD_COLUMNS),
  );
  return z.array(productCardSchema).parse(data);
}

/** The region and slug of every live product (the sitemap), read in pages: the API returns at most 1,000 rows. */
export async function listProductPaths(
  client: IwcClient,
): Promise<{ region_slug: string | null; slug: string }[]> {
  const PAGE = 1000;
  const paths: { region_slug: string | null; slug: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = z.array(z.object({ region_slug: z.string().nullable(), slug: z.string() })).parse(
      unwrap(
        await client
          .from('store_products')
          .select('region_slug, slug')
          .order('id')
          .range(offset, offset + PAGE - 1),
      ),
    );
    paths.push(...rows);
    if (rows.length < PAGE) return paths;
  }
}

/** Explore: one row per category of a type, each with its total and first 12 cards (1 round trip, D-062). */
export async function getTypeRows(client: IwcClient, productType: ProductType): Promise<TypeRow[]> {
  const data = unwrap(await client.rpc('store_type_rows', { p_type: productType }, { get: true }));
  return z.array(typeRowSchema).parse(data);
}

const ORDER_SUMMARY_COLUMNS = `id, order_number, email, customer_status, est_delivery_from, est_delivery_to, subtotal_cents, discount_cents,
  shipping_cents, tax_cents, total_cents, currency, payment_status, shipping_address, tracking_number, carrier, created_at,
  shipping_method, refunded_cents`;

/** /account/orders: the signed-in customer's own orders (the view filters by auth.uid()). */
export async function listMyOrders(client: IwcClient): Promise<OrderSummary[]> {
  const data = unwrap(
    await client
      .from('store_orders')
      .select(ORDER_SUMMARY_COLUMNS)
      .order('created_at', { ascending: false }),
  );
  return z.array(orderSummarySchema).parse(data);
}

export interface OrderCard extends OrderSummary {
  /** The first piece's photo (the order's items sorted by name, as the order page lists them); null without one. */
  first_image_path: string | null;
  /** How many other pieces the card's "+n" counts. */
  more_pieces: number;
}

/**
 * The profile's order cards (D-089): the customer's own orders (newest first) with the first piece's photo and how
 * many more pieces there are. Two reads: the orders, then their items through store_order_items (own rows only).
 */
export async function listMyOrderCards(client: IwcClient): Promise<OrderCard[]> {
  const orders = await listMyOrders(client);
  if (orders.length === 0) return [];
  const items = z
    .array(
      z.object({
        order_id: z.string(),
        product_name: z.string(),
        quantity: z.number().int(),
        image_path: z.string().nullable(),
      }),
    )
    .parse(
      unwrap(
        await client
          .from('store_order_items')
          .select('order_id, product_name, quantity, image_path')
          .in(
            'order_id',
            orders.map((o) => o.id),
          )
          .order('product_name'),
      ),
    );
  return orders.map((o) => {
    const mine = items.filter((i) => i.order_id === o.id);
    const pieces = mine.reduce((n, i) => n + i.quantity, 0);
    return {
      ...o,
      first_image_path: mine[0]?.image_path ?? null,
      more_pieces: Math.max(pieces - 1, 0),
    };
  });
}

/** /account/orders/[number]: own order with items + visible events; null if not theirs. */
export async function getMyOrder(
  client: IwcClient,
  orderNumber: string,
): Promise<OrderDetail | null> {
  const data = unwrap(
    await client.rpc('store_my_order', { p_order_number: orderNumber }, { get: true }),
  );
  return data === null ? null : orderDetailSchema.parse(data);
}

/** The Shipping & returns page's numbers (store_policy, migration 27). */
export async function getStorePolicy(client: IwcClient): Promise<StorePolicy> {
  return storePolicySchema.parse(
    unwrap(await client.rpc('store_policy', undefined, { get: true })),
  );
}

/** Whether the store is in demo mode (dev_preview: placeholder listings and demo reviews show, D-078). */
export async function isDemoStore(client: IwcClient): Promise<boolean> {
  return unwrap(await client.rpc('dev_preview', undefined, { get: true })) === true;
}

/**
 * D-154, D-187: a bag's shipments as store_bag_charges works them out: whether its food travels apart (`split`) or is the
 * whole bag (`food_only`), an address outside the 48 states and DC (`outside`: one shipment), and the one parcel's
 * Shipping (its food shipment's share by weight). Never a shop or a source (D-003).
 */
export const bagShipmentsSchema = z.object({
  days_min: z.number().int().nullable(),
  days_max: z.number().int().nullable(),
  food_cents: z.number().int(),
  food_only: z.boolean(),
  split: z.boolean(),
  outside: z.boolean(),
  shipping_cents: z.number().int(),
});
export type BagShipments = z.infer<typeof bagShipmentsSchema>;

export const bagChargesSchema = z.object({
  /** The free-shipping line (null = none). */
  free_min_cents: z.number().int().nullable(),
  /** D-187: the bulk saving and the heavy-item discount start here, not at the free line. */
  bulk_saving_from_cents: z.number().int().nullable(),
  shipping_cents: z.number().int().min(0),
  retailer_cents: z.number().int().min(0),
  /** D-119: the bulk saving (% of the amount over its line, up to the cap); 0 = none. */
  bulk_saving_pct: z.number().min(0).default(0),
  bulk_saving_cap_cents: z.number().int().min(0).default(0),
  /** D-123: the retailer charges are this % of the goods, at least `retailer_cents`; 0 = the fixed amount. */
  retailer_pct: z.number().min(0).default(0),
  /** D-125: what a bag past the free-shipping line still pays as Shipping (0 when its prices pay its flight). */
  past_line_cents: z.number().int().min(0).default(0),
  /** D-140 (F5): the Shipping figure shown struck through once free; null = the small-order Shipping. Display only. */
  shown_shipping_cents: z.number().int().min(0).nullable().optional(),
  /** D-154: the bag's shipments (_bag_shipments). */
  shipments: bagShipmentsSchema.nullable().optional(),
  /** D-187: which of the asked options are food, and each shipment's dates from today (checkout and the order only). */
  food_ids: z.array(z.string().uuid()).default([]),
  /** Heavy-item shipping (founder 2026-10-24): the bag's heavy pieces' charge, what the line takes off, which options. */
  heavy_cents: z.number().int().min(0).default(0),
  heavy_line_off_pct: z.number().min(0).max(100).default(0),
  heavy_ids: z.array(z.string().uuid()).default([]),
  dates: z
    .object({
      food_from: z.string().nullable(),
      food_to: z.string().nullable(),
      standard_from: z.string().nullable(),
      standard_to: z.string().nullable(),
    })
    .nullable()
    .optional(),
});
export type BagCharges = z.infer<typeof bagChargesSchema>;

/** The bag's charges in the shared checkout shape (D-111, D-125): the same rule in the bag, the pill and checkout. */
export function smallOrderOf(c: BagCharges): SmallOrderCharges {
  return {
    shippingCents: c.shipping_cents,
    pastLineCents: c.past_line_cents,
    retailerCents: c.retailer_cents,
    retailerPct: c.retailer_pct || null,
    shownShippingCents: c.shown_shipping_cents ?? null,
  };
}

/** The bag's Heavy-item shipping in the shared checkout shape (null: no heavy piece in the bag). */
export function heavyOf(c: BagCharges): HeavyShipping | null {
  return c.heavy_cents > 0 ? { cents: c.heavy_cents, lineOffPct: c.heavy_line_off_pct } : null;
}

/**
 * D-111: a bag's small-order charges (one courier parcel's shipping beyond what the prices carry, and the retailer
 * charges), worked out in the database where the weights are (INV-1). Charged below `free_min_cents`, struck through
 * from it up; from `bulk_saving_from_cents` up the bulk saving's two numbers apply (D-119, D-187). The bag, the
 * free-delivery bar and checkout all read this one function.
 */
export async function getBagCharges(
  client: IwcClient,
  items: { variantId: string; quantity: number }[],
  /** D-154: at checkout, the promo's discount and the address decide the food shipment too. */
  at: { discountCents?: number; state?: string; line1?: string } = {},
): Promise<BagCharges> {
  const data = unwrap(
    await client.rpc('store_bag_charges', {
      p_items: items.slice(0, 50).map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
      ...(at.discountCents ? { p_discount_cents: at.discountCents } : {}),
      ...(at.state ? { p_state: at.state } : {}),
      ...(at.line1 ? { p_line1: at.line1 } : {}),
    }),
  );
  return bagChargesSchema.parse(data);
}

/**
 * The tagged photos of some listings, main photo first (D-194). Only the + reads this, and a failed read just leaves
 * the options without a look's photo, so the + still opens.
 */
async function taggedPhotos(client: IwcClient, productIds: string[]) {
  const { data } = await client
    .from('store_media')
    .select('product_id, variant_id, storage_path')
    .in('product_id', productIds)
    .not('variant_id', 'is', null)
    .order('is_primary', { ascending: false })
    .order('sort_order')
    .limit(1000);
  return (data ?? []).map((m) => ({
    product_id: m.product_id,
    variant_id: m.variant_id,
    storage_path: m.storage_path ?? '',
  }));
}

/**
 * The options a card's + offers (D-140, F9), read when the + is pressed instead of sent with every card (D-145): the
 * same 20 the store's card functions list, in their order (migration 20261018120000).
 */
export async function getCardOptions(client: IwcClient, productId: string): Promise<CardOption[]> {
  const [read, photos] = await Promise.all([
    client
      .from('store_variants')
      .select('id, label, options, price_cents, available')
      .eq('product_id', productId)
      .order('sort_order')
      .order('label')
      .limit(20),
    taggedPhotos(client, [productId]),
  ]);
  return withLookPhotos(z.array(cardOptionSchema).parse(unwrap(read)), photos);
}

/**
 * Several cards' options in one read (2026-10-30): the cards with several options a page has on screen, read while the
 * shopper looks, so a + opens at once. Up to 48 pieces, each with the same 20 options as getCardOptions, in its order.
 */
export async function getCardOptionsFor(
  client: IwcClient,
  productIds: string[],
): Promise<Record<string, CardOption[]>> {
  const ids = [...new Set(productIds)].slice(0, 48);
  const out: Record<string, CardOption[]> = Object.fromEntries(
    ids.map((id) => [id, [] as CardOption[]]),
  );
  if (ids.length === 0) return out;
  const [read, photos] = await Promise.all([
    client
      .from('store_variants')
      .select('product_id, id, label, options, price_cents, available')
      .in('product_id', ids)
      .order('sort_order')
      .order('label')
      .limit(1000),
    taggedPhotos(client, ids),
  ]);
  for (const row of unwrap(read)) {
    const list = out[row.product_id];
    if (list && list.length < 20) list.push(cardOptionSchema.parse(row));
  }
  if (photos.length === 0) return out;
  for (const id of ids) {
    const own = photos.filter((m) => m.product_id === id);
    if (own.length > 0) out[id] = withLookPhotos(out[id] ?? [], own);
  }
  return out;
}

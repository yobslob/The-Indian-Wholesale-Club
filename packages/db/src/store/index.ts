/**
 * Customer-safe reads. ONLY store_* views/functions are used here (D-017), and
 * every payload is validated by the zod schemas in ./schemas.
 * Customer code (storefront, customer app screens) imports from '@repo/db/store' only.
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

import {
  browsePageSchema,
  deliveryWindowSchema,
  homeSchema,
  orderDetailSchema,
  orderSummarySchema,
  productCardSchema,
  productPageSchema,
  regionPageSchema,
  storePolicySchema,
  type BrowsePage,
  type DeliveryWindow,
  type HomeData,
  type OrderDetail,
  type OrderSummary,
  type ProductCard,
  type ProductPage,
  type RegionPage,
  type StorePolicy,
  type TypeRow,
  typeRowSchema,
} from './schemas';

export * from './schemas';

/** Home + /states: all 36 regions and the next delivery window (1 round trip). */
export async function getHome(client: IwcClient): Promise<HomeData> {
  const data = unwrap(await client.rpc('store_home'));
  return homeSchema.parse(data);
}

/** /states/[region]: null when the region slug does not exist (1 round trip). */
export async function getRegionPage(
  client: IwcClient,
  regionSlug: string,
): Promise<RegionPage | null> {
  const data = unwrap(await client.rpc('store_region_page', { p_region_slug: regionSlug }));
  return data === null ? null : regionPageSchema.parse(data);
}

/** /states/[region]/[product]: null when not found or not live (1 round trip). */
export async function getProductPage(
  client: IwcClient,
  regionSlug: string,
  productSlug: string,
): Promise<ProductPage | null> {
  const data = unwrap(
    await client.rpc('store_product_page', {
      p_region_slug: regionSlug,
      p_product_slug: productSlug,
    }),
  );
  return data === null ? null : productPageSchema.parse(data);
}

export async function getNextDelivery(client: IwcClient): Promise<DeliveryWindow | null> {
  const rows = unwrap(await client.rpc('store_next_delivery'));
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return first ? deliveryWindowSchema.parse(first) : null;
}

const PRODUCT_CARD_COLUMNS =
  'id, slug, name, product_type, region_slug, region_name, category_slug, category_name, price_cents, primary_image_path';

export interface BrowseFilter {
  productType: 'clothing' | 'spice';
  regionSlug?: string;
  categorySlug?: string;
  /** Skip this many (the next page of a See all list). */
  offset?: number;
  /** At most 500 (the database caps it). */
  limit?: number;
}

/**
 * See all (website /clothing and /spices, the app's Browse; D-062, D-067): one page of light cards newest first, the
 * total, and the per-state and per-category counts for the filters, in one round trip (store_browse).
 */
export async function browseProducts(client: IwcClient, filter: BrowseFilter): Promise<BrowsePage> {
  const data = unwrap(
    await client.rpc('store_browse', {
      p_type: filter.productType,
      ...(filter.regionSlug ? { p_region: filter.regionSlug } : {}),
      ...(filter.categorySlug ? { p_category: filter.categorySlug } : {}),
      p_offset: filter.offset ?? 0,
      p_limit: filter.limit ?? 24,
    }),
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
export async function listProductPaths(client: IwcClient): Promise<{ region_slug: string; slug: string }[]> {
  const PAGE = 1000;
  const paths: { region_slug: string; slug: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const rows = z
      .array(z.object({ region_slug: z.string(), slug: z.string() }))
      .parse(
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
export async function getTypeRows(client: IwcClient, productType: 'clothing' | 'spice'): Promise<TypeRow[]> {
  const data = unwrap(await client.rpc('store_type_rows', { p_type: productType }));
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

/** /account/orders/[number]: own order with items + visible events; null if not theirs. */
export async function getMyOrder(
  client: IwcClient,
  orderNumber: string,
): Promise<OrderDetail | null> {
  const data = unwrap(await client.rpc('store_my_order', { p_order_number: orderNumber }));
  return data === null ? null : orderDetailSchema.parse(data);
}

/** The Shipping & returns page's numbers (store_policy, migration 27). */
export async function getStorePolicy(client: IwcClient): Promise<StorePolicy> {
  return storePolicySchema.parse(unwrap(await client.rpc('store_policy')));
}

/** Whether the store is in demo mode (dev_preview: placeholder listings and demo reviews show, D-078). */
export async function isDemoStore(client: IwcClient): Promise<boolean> {
  return unwrap(await client.rpc('dev_preview')) === true;
}

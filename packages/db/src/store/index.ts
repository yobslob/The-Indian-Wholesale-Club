/**
 * Customer-safe reads. ONLY store_* views/functions are used here (D-017), and
 * every payload is validated by the zod schemas in ./schemas.
 * Customer code (storefront, customer app screens) imports from '@repo/db/store' only.
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

import {
  deliveryWindowSchema,
  homeSchema,
  orderDetailSchema,
  orderSummarySchema,
  productCardSchema,
  productPageSchema,
  regionPageSchema,
  type DeliveryWindow,
  type HomeData,
  type OrderDetail,
  type OrderSummary,
  type ProductCard,
  type ProductPage,
  type RegionPage,
} from './schemas';

export * from './schemas';

/** Home + /states: all 36 regions and the next delivery window (1 round trip). */
export async function getHome(client: IwcClient): Promise<HomeData> {
  const data = unwrap(await client.rpc('store_home'));
  return homeSchema.parse(data);
}

/** /states/[region]: null when the region slug does not exist (1 round trip). */
export async function getRegionPage(client: IwcClient, regionSlug: string): Promise<RegionPage | null> {
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
    await client.rpc('store_product_page', { p_region_slug: regionSlug, p_product_slug: productSlug }),
  );
  return data === null ? null : productPageSchema.parse(data);
}

export async function getNextDelivery(client: IwcClient): Promise<DeliveryWindow | null> {
  const rows = unwrap(await client.rpc('store_next_delivery'));
  const first = Array.isArray(rows) ? rows[0] : undefined;
  return first ? deliveryWindowSchema.parse(first) : null;
}

const PRODUCT_CARD_COLUMNS =
  'id, slug, name, product_type, region_slug, region_name, category_slug, category_name, summary, price_cents, primary_image_path';

export interface ProductListFilter {
  productType?: 'clothing' | 'spice';
  regionSlug?: string;
  categorySlug?: string;
  /** Full-text search over name, craft, summary, description. */
  search?: string;
  limit?: number;
}

/** /clothing, /spices, /search: product cards (1 round trip). */
export async function listProducts(client: IwcClient, filter: ProductListFilter = {}): Promise<ProductCard[]> {
  let query = client.from('store_products').select(PRODUCT_CARD_COLUMNS);
  if (filter.productType) query = query.eq('product_type', filter.productType);
  if (filter.regionSlug) query = query.eq('region_slug', filter.regionSlug);
  if (filter.categorySlug) query = query.eq('category_slug', filter.categorySlug);
  if (filter.search && filter.search.trim()) {
    query = query.textSearch('search', filter.search.trim(), { type: 'websearch', config: 'simple' });
  }
  const data = unwrap(await query.order('name').limit(filter.limit ?? 60));
  return z.array(productCardSchema).parse(data);
}

const ORDER_SUMMARY_COLUMNS =
  'id, order_number, email, customer_status, est_delivery_from, est_delivery_to, subtotal_cents, discount_cents, ' +
  'shipping_cents, tax_cents, total_cents, currency, payment_status, shipping_address, tracking_number, carrier, created_at';

/** /account/orders: the signed-in customer's own orders (the view filters by auth.uid()). */
export async function listMyOrders(client: IwcClient): Promise<OrderSummary[]> {
  const data = unwrap(
    await client.from('store_orders').select(ORDER_SUMMARY_COLUMNS).order('created_at', { ascending: false }),
  );
  return z.array(orderSummarySchema).parse(data);
}

/** /account/orders/[number]: own order with items + visible events; null if not theirs. */
export async function getMyOrder(client: IwcClient, orderNumber: string): Promise<OrderDetail | null> {
  const data = unwrap(await client.rpc('store_my_order', { p_order_number: orderNumber }));
  return data === null ? null : orderDetailSchema.parse(data);
}

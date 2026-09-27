import { z } from 'zod';

/**
 * Shapes of everything the customer side reads (store_* views and functions).
 * zod strips unknown keys, so even if the database ever returned an extra
 * column it would not reach the UI (defense in depth for D-003 / INV-1).
 */

const productType = z.enum(['clothing', 'spice']);
const isoDate = z.string(); // 'YYYY-MM-DD'
const isoDateTime = z.string();

export const deliveryWindowSchema = z.object({
  order_by: isoDateTime,
  est_delivery_from: isoDate,
  est_delivery_to: isoDate,
});

export const regionCardSchema = z.object({
  slug: z.string(),
  name: z.string(),
  is_live: z.boolean(),
  accent_color: z.string().nullable(),
  hero_image_path: z.string().nullable(),
  greeting_native: z.string().nullable(),
  greeting_script: z.string().nullable(),
  greeting_latin: z.string().nullable(),
  tagline: z.string().nullable(),
});

export const regionSchema = regionCardSchema.extend({
  id: z.string().uuid(),
  sort_order: z.number().int(),
  greeting_meaning: z.string().nullable(),
  story: z.string().nullable(),
});

export const productCardSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  product_type: productType,
  region_slug: z.string(),
  region_name: z.string(),
  category_slug: z.string(),
  category_name: z.string(),
  summary: z.string().nullable(),
  price_cents: z.number().int(),
  primary_image_path: z.string().nullable(),
});

export const regionProductCardSchema = productCardSchema.extend({
  craft: z.string().nullable(),
  available: z.number().int(),
});

export const productSchema = productCardSchema.extend({
  region_id: z.string().uuid(),
  category_id: z.string().uuid(),
  description: z.string().nullable(),
  story: z.string().nullable(),
  craft: z.string().nullable(),
  attributes: z.record(z.unknown()),
  published_at: isoDateTime.nullable(),
});

export const variantSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  label: z.string(),
  options: z.record(z.unknown()),
  price_cents: z.number().int(),
  available: z.number().int(),
  sort_order: z.number().int(),
});

export const mediaSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable(),
  storage_path: z.string(),
  alt_text: z.string(),
  sort_order: z.number().int(),
  is_primary: z.boolean(),
});

export const homeSchema = z.object({
  regions: z.array(regionCardSchema),
  delivery: deliveryWindowSchema.nullable(),
});

export const regionPageSchema = z.object({
  region: regionSchema,
  products: z.array(regionProductCardSchema),
});

export const productPageSchema = z.object({
  product: productSchema,
  variants: z.array(variantSchema),
  media: z.array(mediaSchema),
  delivery: deliveryWindowSchema.nullable(),
});

export const customerStatusSchema = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  email: z.string(),
  customer_status: customerStatusSchema,
  est_delivery_from: isoDate.nullable(),
  est_delivery_to: isoDate.nullable(),
  subtotal_cents: z.number().int(),
  discount_cents: z.number().int(),
  shipping_cents: z.number().int(),
  tax_cents: z.number().int(),
  total_cents: z.number().int(),
  currency: z.string(),
  payment_status: z.string(),
  shipping_address: z.record(z.unknown()),
  tracking_number: z.string().nullable(),
  carrier: z.string().nullable(),
  created_at: isoDateTime,
});

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  product_name: z.string(),
  variant_label: z.string(),
  region_name: z.string(),
  quantity: z.number().int(),
  unit_price_cents: z.number().int(),
  total_price_cents: z.number().int(),
  status: z.enum(['active', 'unavailable', 'refunded']),
});

export const orderEventSchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  kind: z.string(),
  message: z.string().nullable(),
  created_at: isoDateTime,
});

export const orderDetailSchema = z.object({
  order: orderSummarySchema,
  items: z.array(orderItemSchema),
  events: z.array(orderEventSchema),
});

export type DeliveryWindow = z.infer<typeof deliveryWindowSchema>;
export type RegionCard = z.infer<typeof regionCardSchema>;
export type Region = z.infer<typeof regionSchema>;
export type ProductCard = z.infer<typeof productCardSchema>;
export type RegionProductCard = z.infer<typeof regionProductCardSchema>;
export type Product = z.infer<typeof productSchema>;
export type Variant = z.infer<typeof variantSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type HomeData = z.infer<typeof homeSchema>;
export type RegionPage = z.infer<typeof regionPageSchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type CustomerStatus = z.infer<typeof customerStatusSchema>;
export type OrderSummary = z.infer<typeof orderSummarySchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderEvent = z.infer<typeof orderEventSchema>;
export type OrderDetail = z.infer<typeof orderDetailSchema>;

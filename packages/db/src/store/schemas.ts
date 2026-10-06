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
  price_cents: z.number().int(),
  primary_image_path: z.string().nullable(),
});

/** Set only when the product has exactly one variant and it is in stock: a card's "Add" puts it in the bag. */
export const quickAddSchema = z.object({
  variant_id: z.string().uuid(),
  label: z.string(),
  price_cents: z.number().int(),
});

/** Product card with availability, as store_home / store_region_page / store_product_page return it (C1). */
export const regionProductCardSchema = productCardSchema.extend({
  available: z.number().int(),
  published_at: isoDateTime.nullable(),
  quick_add: quickAddSchema.nullable(),
});

export const productSchema = productCardSchema.extend({
  region_id: z.string().uuid(),
  category_id: z.string().uuid(),
  summary: z.string().nullable(),
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
  /** The twelve newest live products (Just listed, D-062). */
  just_listed: z.array(regionProductCardSchema),
  delivery: deliveryWindowSchema.nullable(),
});

/** A region album photo (D-051): only the file and what it shows. */
export const albumPhotoSchema = z.object({ storage_path: z.string(), alt_text: z.string() });

export const regionPageSchema = z.object({
  region: regionSchema,
  /** The region album, in the admin's order (migration 10). */
  album: z.array(albumPhotoSchema),
  /** The cards the page draws, newest first: the newest 12 (New arrivals) and the first 12 of each category. */
  products: z.array(regionProductCardSchema),
  /** Every category of the region with its real total (the section pills, See all), biggest first. */
  category_counts: z.array(
    z.object({ slug: z.string(), name: z.string(), product_type: productType, count: z.number().int() }),
  ),
  /** Most wanted: up to 12 in-stock pieces ordered most in the last 30 days (D-058). Ranking only, no counts. */
  most_wanted: z.array(regionProductCardSchema),
  /** Curated for you: up to 12 admin picks in the region (D-056). */
  curated: z.array(regionProductCardSchema),
  /** Leaving soon: up to 12 live pieces with 1 to leaving_soon_max left, fewest first (D-056). */
  leaving_soon: z.array(regionProductCardSchema),
});

/** Approved reviews only (store_reviews): never who wrote them beyond the chosen display name (INV-1). */
export const reviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string(),
  display_name: z.string(),
  is_verified_buyer: z.boolean(),
  created_at: isoDateTime,
  photos: z.array(z.string()),
});

export const reviewsSummarySchema = z.object({
  count: z.number().int(),
  average: z.number().nullable(),
  histogram: z.record(z.enum(['1', '2', '3', '4', '5']), z.number().int()),
  /** The six newest approved reviews. */
  items: z.array(reviewSchema),
});

export const productPageSchema = z.object({
  product: productSchema,
  variants: z.array(variantSchema),
  media: z.array(mediaSchema),
  /** Up to 12 other live products in the same category, own region first. */
  similar: z.array(regionProductCardSchema),
  /** The region's other admin picks (Curated for you, D-056). */
  curated: z.array(regionProductCardSchema),
  /** Approved reviews: summary over all of them and the six newest (D-051, D-056). */
  reviews: reviewsSummarySchema,
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
  shipping_method: z.enum(['standard', 'express']),
  refunded_cents: z.number().int(),
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

/** D-064: an earlier delivery the customer can pay for. Price and window only (D-003). */
export const orderOfferSchema = z.object({
  price_cents: z.number().int().positive(),
  est_delivery_from: z.string(),
  est_delivery_to: z.string(),
});

/** What the customer may do now (D-042 cancel before cutoff, D-008 keep or cancel after a delay), with the refunds. */
export const orderActionsSchema = z.object({
  can_cancel: z.boolean(),
  cancel_refund_cents: z.number().int().nullable(),
  delay_open: z.boolean(),
  delay_refund_cents: z.number().int().nullable(),
});

export const orderDetailSchema = z.object({
  order: orderSummarySchema,
  items: z.array(orderItemSchema),
  events: z.array(orderEventSchema),
  offer: orderOfferSchema.nullable().default(null),
  actions: orderActionsSchema.nullable().default(null),
});

export type DeliveryWindow = z.infer<typeof deliveryWindowSchema>;
export type RegionCard = z.infer<typeof regionCardSchema>;
export type Region = z.infer<typeof regionSchema>;
export type ProductCard = z.infer<typeof productCardSchema>;
export type RegionProductCard = z.infer<typeof regionProductCardSchema>;

/** store_type_rows(): one row per category, its total and its first 12 cards (D-062). */
export const typeRowSchema = z.object({
  slug: z.string(),
  name: z.string(),
  count: z.number().int(),
  products: z.array(regionProductCardSchema),
});
export type TypeRow = z.infer<typeof typeRowSchema>;

/** store_browse(): one page of a See all list, its total, and the counts behind the state and category filters. */
const filterCountSchema = z.object({ slug: z.string(), name: z.string(), count: z.number().int() });
export const browsePageSchema = z.object({
  total: z.number().int(),
  /** Every state with pieces of this type (the state filter), A–Z. */
  regions: z.array(filterCountSchema),
  /** The categories within the chosen state (the category filter), biggest first. */
  categories: z.array(filterCountSchema),
  products: z.array(productCardSchema),
});
export type BrowsePage = z.infer<typeof browsePageSchema>;
export type QuickAdd = z.infer<typeof quickAddSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ReviewsSummary = z.infer<typeof reviewsSummarySchema>;
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
export type OrderOffer = z.infer<typeof orderOfferSchema>;
export type OrderActions = z.infer<typeof orderActionsSchema>;

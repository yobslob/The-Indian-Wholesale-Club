import { z } from 'zod';

import { variantOptionsSchema } from '../../domain/listing';
import { PRODUCT_TYPES } from '../../domain/product-types';

/**
 * The sourcing runner's shapes (D-118): its work from the database (worker_sourcing_plan) and a shop's search
 * result. Everything a shop's page gives is untrusted: it is parsed into these and capped, never stored as it is.
 */

export const SHOP_READERS = [
  'amazon',
  'flipkart',
  'myntra',
  'shopify',
  'blinkit',
  'bigbasket',
  'zepto',
  'instamart',
] as const;
export type ShopReader = (typeof SHOP_READERS)[number];

const paise = z.number().int().positive().nullable();

/** One search result on a shop. Money in paise. */
export const offerSchema = z.object({
  site: z.string().min(3).max(120),
  url: z.string().url().max(2000),
  /** The shop's id for the item (ASIN, pid, product id, handle). */
  key: z.string().min(1).max(200),
  title: z.string().min(1).max(400),
  brand: z.string().max(120).nullable(),
  pricePaise: paise,
  mrpPaise: paise,
  inStock: z.boolean().nullable(),
  /** The delivery promise as the result prints it ("15 MINS", "FREE delivery Wed, 21 Oct"). */
  deliveryText: z.string().max(300).nullable(),
  /** Pack size as the shop prints it ("500 g"). */
  pack: z.string().max(80).nullable(),
  rating: z.number().min(0).max(5).nullable(),
  ratingCount: z.number().int().min(0).nullable(),
  sponsored: z.boolean(),
  image: z.string().url().max(2000).nullable(),
  /** Items of one family on the shop (Blinkit's group, BigBasket's parent): the pack sizes of one product. */
  group: z.string().max(200).nullable(),
  /** The same product's other pages to read with it (Myntra's other colours). */
  siblings: z.array(z.string().url().max(2000)).max(12),
});
export type Offer = z.infer<typeof offerSchema>;

export const targetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  query: z.string(),
  must_match: z.string().nullable(),
  product_type: z.enum(PRODUCT_TYPES),
  category: z.string(),
  /** Null: all states (D-121), the listings carry no state. */
  region: z.string().nullable(),
  tier: z.number().int().nullable(),
  /** Only these shops (hosts, "myntra.com"); null: every shop of the type (D-121). */
  sites: z.array(z.string()).nullable().default(null),
  /** The shop's price band in paise, either end open (D-121). */
  min_price_paise: z.number().int().positive().nullable().default(null),
  max_price_paise: z.number().int().positive().nullable().default(null),
  /** How many listings to make for it; null: the setting (listings per target). */
  listings: z.number().int().min(1).max(40).nullable().default(null),
});
export type SourcingTarget = z.infer<typeof targetSchema>;

export const shopSchema = z.object({
  site: z.string(),
  label: z.string(),
  reader: z.enum(SHOP_READERS),
  product_types: z.array(z.enum(PRODUCT_TYPES)),
  delivery_days: z.number().int().nullable(),
});
export type SourcingShop = z.infer<typeof shopSchema>;

export const settingsSchema = z.object({
  max_delivery_days: z.number().int(),
  listings_per_target: z.number().int(),
  check_every_days: z.number().int(),
  qty_per_variant: z.number().int(),
  targets_per_run: z.number().int(),
  max_rise_pct: z.number().int(),
  max_drop_pct: z.number().int(),
  auto_publish: z.boolean(),
});
export type SourcingSettings = z.infer<typeof settingsSchema>;

export const checkSourceSchema = z.object({
  id: z.string().uuid(),
  site: z.string(),
  page_url: z.string().url(),
  item_url: z.string().url(),
  item_key: z.string().nullable(),
  label: z.string(),
  options: z.record(z.unknown()),
});
export type CheckSource = z.infer<typeof checkSourceSchema>;

export const planSchema = z.object({
  settings: settingsSchema,
  shops: z.array(shopSchema),
  targets: z.array(targetSchema),
  checks: z.array(
    z.object({
      product_id: z.string().uuid(),
      name: z.string(),
      sources: z.array(checkSourceSchema),
    }),
  ),
  known: z.array(z.string()),
});
export type SourcingPlan = z.infer<typeof planSchema>;

/** What worker_sourcing_add takes for one variant (snake_case: it goes to the database as it is). */
export const listingVariantPayloadSchema = z.object({
  item_key: z.string().min(1).max(200),
  item_url: z.string().url().max(2000),
  page_url: z.string().url().max(2000).optional(),
  label: z.string().min(1).max(80),
  options: variantOptionsSchema,
  price_paise: z.number().int().positive(),
  mrp_paise: z.number().int().positive().nullable(),
  in_stock: z.boolean(),
  delivery_days: z.number().int().min(0).max(60).nullable(),
  weight_g: z.number().int().positive().max(50_000).nullable(),
});
export type ListingVariantPayload = z.infer<typeof listingVariantPayloadSchema>;

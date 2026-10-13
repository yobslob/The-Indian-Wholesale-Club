import { z } from 'zod';

import { variantOptionsSchema } from '../domain/listing';

/**
 * What the "Add to IWC" button (bookmarklet.ts) or the server's page fetch (html.ts) reads off a shop's product page.
 * It is untrusted input from another site: every field is optional, size-capped, and only ever parsed (normalize.ts),
 * never stored as it is.
 */
const str = (max: number) => z.string().max(max);
export const rawCaptureSchema = z.object({
  v: z.literal(1),
  url: str(2000),
  canonical: str(2000).optional(),
  title: str(1000).optional(),
  meta: z.record(z.array(str(2000)).max(20)).optional(),
  ld: z.array(str(80_000)).max(12).optional(),
  myntra: z.unknown().optional(),
  amazon: z
    .object({
      title: str(1000).optional(),
      price: str(100).optional(),
      mrp: str(100).optional(),
      byline: str(300).optional(),
      availability: str(500).optional(),
      bullets: z.array(str(2000)).max(20).optional(),
      description: str(8000).optional(),
      important: str(5000).optional(),
      specs: z
        .array(z.tuple([str(200), str(1000)]))
        .max(80)
        .optional(),
      images: z.array(str(2000)).max(80).optional(),
      size: str(100).optional(),
      asin: str(20).optional(),
      /** Amazon's variation picker: which option each item (ASIN) has, and the swatches' own prices (D-118). */
      twister: z
        .object({
          dims: z.array(str(60)).max(4).optional(),
          labels: z.record(str(80)).optional(),
          values: z.record(z.array(str(120)).max(4)).optional(),
          swatches: z
            .array(
              z.object({
                asin: str(20),
                dim: str(60).optional(),
                label: str(200).optional(),
                price: str(100).optional(),
                mrp: str(100).optional(),
                available: z.boolean().optional(),
              }),
            )
            .max(300)
            .optional(),
        })
        .optional(),
    })
    .optional(),
  /** The page's delivery promise as printed ("FREE delivery Wednesday, 21 October", "Delivery by Fri, 16 Oct"). */
  delivery: str(300).optional(),
  /** Other variations as links (Flipkart): the picked value per option, and the other values' pages. */
  swatch: z
    .object({
      selected: z
        .array(z.tuple([str(60), str(120)]))
        .max(4)
        .optional(),
      links: z
        .array(z.object({ url: str(2000), label: str(200), axis: str(60).optional() }))
        .max(80)
        .optional(),
    })
    .optional(),
  /** Shopify's own product data on its pages (window.ShopifyAnalytics.meta.product). */
  shopify: z.unknown().optional(),
  dom: z
    .object({ images: z.array(str(2000)).max(30).optional(), h1: str(1000).optional() })
    .optional(),
});
export type RawCapture = z.infer<typeof rawCaptureSchema>;

/**
 * One buyable item of a product page: a flavour, a pack size, a colour and size. `key` is the shop's id for it (an
 * ASIN, a Flipkart pid, a Myntra sku, a Shopify variant id) and `url` where it is ordered. Money in paise.
 */
export const sourcedVariantSchema = z.object({
  key: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  label: z.string().min(1).max(80),
  options: variantOptionsSchema,
  pricePaise: z.number().int().positive().nullable(),
  mrpPaise: z.number().int().positive().nullable(),
  inStock: z.boolean().nullable(),
  weightG: z.number().int().positive().max(50_000).nullable(),
  image: z.string().url().max(2000).nullable(),
});
export type SourcedVariant = z.infer<typeof sourcedVariantSchema>;

/** A product as the importer shows it for review: one shape for every shop. Money in paise (CLAUDE.md rule 5). */
export const sourcedProductSchema = z.object({
  /** The cleaned product address (url.ts), the key that finds an earlier import. */
  url: z.string().url().max(2000),
  /** "myntra.com" */
  site: z.string().min(3).max(120),
  title: z.string().max(300),
  brand: z.string().max(120).nullable(),
  /** Plain text, paragraphs separated by blank lines. */
  description: z.string().max(8000),
  bullets: z.array(z.string().max(1000)).max(20),
  specs: z.array(z.tuple([z.string().max(200), z.string().max(1000)])).max(80),
  /** https photo addresses, the main one first. */
  images: z.array(z.string().url().max(2000)).max(15),
  pricePaise: z.number().int().positive().nullable(),
  mrpPaise: z.number().int().positive().nullable(),
  /** "INR" when the page says so or the shop is Indian; another code means the price is not in rupees. */
  currency: z.string().max(8).nullable(),
  inStock: z.boolean().nullable(),
  sizes: z.array(z.object({ label: z.string().min(1).max(40), available: z.boolean() })).max(40),
  /** The shop's own grouping ("Sarees", "Women"), used only to guess the type and category. */
  hints: z.array(z.string().max(120)).max(10),
  /** Its items, each with its own price and stock when the page shows them (D-118); empty: one item. */
  variants: z.array(sourcedVariantSchema).max(60).default([]),
  /** The delivery promise as the page prints it (delivery.ts turns it into days). */
  deliveryText: z.string().max(300).nullable().default(null),
});
export type SourcedProduct = z.infer<typeof sourcedProductSchema>;

/** Base64 of UTF-8 JSON, as the bookmarklet sends it in the import page's address (#iwc=…). */
export function decodeCapturePayload(payload: string): RawCapture | null {
  try {
    const bytes = Uint8Array.from(atob(decodeURIComponent(payload)), (c) => c.charCodeAt(0));
    const parsed = rawCaptureSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

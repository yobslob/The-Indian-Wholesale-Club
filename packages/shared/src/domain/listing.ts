import { z } from 'zod';

import { clothingAttributesSchema, spiceAttributesSchema } from './attributes';

/**
 * A new listing (flows.md §2, C3), as the admin builds it on the web or on a phone and sends it to
 * admin_create_listing(). One schema for both, so a listing is checked the same way wherever it is made.
 * Money is integer cents / paise (CLAUDE.md rule 5).
 */
export const listingVariantSchema = z.object({
  label: z.string().trim().min(1).max(80),
  /** Colour and size drive the product page pickers (variant-options.ts). */
  options: z
    .object({
      colour: z.string().trim().min(1).max(40).optional(),
      size: z.string().trim().min(1).max(40).optional(),
    })
    .strict(),
  /** Pieces the shop has now. */
  qty: z.number().int().min(0).max(9999),
  weight_g: z.number().int().positive().max(50_000).optional(),
});

const common = {
  vendor_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(90),
  summary: z.string().trim().max(300).optional(),
  /** Empty = priced automatically from the shop price and weight (D-075). */
  price_cents: z.number().int().positive().optional(),
  shop_price_paise: z.number().int().min(0).optional(),
  variants: z.array(listingVariantSchema).max(60),
};

export const listingInputSchema = z.discriminatedUnion('product_type', [
  z.object({ ...common, product_type: z.literal('clothing'), attributes: clothingAttributesSchema }),
  z.object({ ...common, product_type: z.literal('spice'), attributes: spiceAttributesSchema }),
]);
export type ListingInput = z.infer<typeof listingInputSchema>;

/** "Red · M", "Red", "M", or "One size": the label customers see on a variant. */
export function variantLabel(options: { colour?: string; size?: string }): string {
  return [options.colour?.trim(), options.size?.trim()].filter(Boolean).join(' · ') || 'One size';
}

/** A URL slug from the name, with a short suffix so two listings with one name never clash. */
export function listingSlug(name: string, suffix: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [base || 'listing', tail].filter(Boolean).join('-');
}

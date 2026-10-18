import { z } from 'zod';

import { clothingAttributesSchema, homeAttributesSchema, foodAttributesSchema } from './attributes';
import { OPTION_KEYS, type OptionKey } from './variant-options';
import { WEARS } from './wears';
import { WEIGHT_SOURCES } from './weight';

const optionValue = z.string().trim().min(1).max(40).optional();
/** What tells variants apart; nothing else may be stored there (customers see it). */
export const variantOptionsSchema = z
  .object(
    Object.fromEntries(OPTION_KEYS.map((k) => [k, optionValue])) as Record<OptionKey, typeof optionValue>,
  )
  .strict();
export type VariantOptions = z.infer<typeof variantOptionsSchema>;

/**
 * A new listing (flows.md §2, C3), as the admin builds it on the web or on a phone and sends it to
 * admin_create_listing(). One schema for both, so a listing is checked the same way wherever it is made.
 * Money is integer cents / paise (CLAUDE.md rule 5).
 */
export const listingVariantSchema = z.object({
  label: z.string().trim().min(1).max(80),
  /** Colour, flavour, style, pack and size drive the product page pickers (variant-options.ts, D-118). */
  options: variantOptionsSchema,
  /** Pieces the shop has now. */
  qty: z.number().int().min(0).max(9999),
  weight_g: z.number().int().positive().max(50_000).optional(),
  /** Where the weight came from (D-129); the database counts a weight with none as typed by the admin. */
  weight_source: z.enum(WEIGHT_SOURCES).optional(),
  weight_note: z.string().trim().max(200).optional(),
  /** This variant's own shop price, when it costs its own amount (a flavour, a pack: D-118). */
  shop_price_paise: z.number().int().positive().optional(),
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
  z.object({
    ...common,
    product_type: z.literal('clothing'),
    attributes: clothingAttributesSchema,
    /** D-140: who it is for; empty = from the name or category (a clothing listing needs one to go live). */
    wears: z.enum(WEARS).optional(),
  }),
  z.object({ ...common, product_type: z.literal('food'), attributes: foodAttributesSchema }),
  z.object({ ...common, product_type: z.literal('home'), attributes: homeAttributesSchema }),
]);
export type ListingInput = z.infer<typeof listingInputSchema>;

/** "Red · M", "Malai · 500 g", "M", or "One size": the label customers see on a variant. */
export function variantLabel(options: Partial<Record<OptionKey, string>>): string {
  return (
    OPTION_KEYS.map((k) => options[k]?.trim())
      .filter(Boolean)
      .join(' · ') || 'One size'
  );
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

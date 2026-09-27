import { z } from 'zod';

/**
 * products.attributes, per product type. These are shown to customers, so the
 * schemas are STRICT: an unknown key (e.g. a vendor detail) is rejected, never
 * stored (D-003). Required fields reflect ops.md §Compliance.
 */
export const clothingAttributesSchema = z
  .object({
    /** e.g. "100% cotton". US textile labelling requires fibre content. */
    fibre_content: z.string().trim().min(1).max(200),
    /** Care instructions shown on the product page. */
    care: z.string().trim().min(1).max(500),
    /** For sarees, dhotis, mundus: length in metres. */
    length_m: z.number().positive().max(20).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const spiceAttributesSchema = z
  .object({
    ingredients: z.string().trim().min(1).max(1000),
    /** Declared allergens; an empty list means "none declared". */
    allergens: z.array(z.string().trim().min(1).max(60)).max(20),
    shelf_life_days: z.number().int().positive().max(3650),
    storage: z.string().trim().max(300).optional(),
  })
  .strict();

export type ClothingAttributes = z.infer<typeof clothingAttributesSchema>;
export type SpiceAttributes = z.infer<typeof spiceAttributesSchema>;

export function attributesSchemaFor(productType: 'clothing' | 'spice') {
  return productType === 'clothing' ? clothingAttributesSchema : spiceAttributesSchema;
}

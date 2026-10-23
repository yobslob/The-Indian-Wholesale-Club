/**
 * 7-day delivery (D-148): the 7-day page and whether a bag is a 7-day bag, through store_* only (D-017). Which shop a
 * piece is bought from decides it in the database; nothing here (or in the answers) names a shop (D-003).
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

import { productCardSchema } from './schemas';

export const quickPageSchema = z.object({
  /** The 7-day days from Settings; null = 7-day delivery is off (no page, no tags). */
  days_min: z.number().int().nullable(),
  days_max: z.number().int().nullable(),
  /** Pieces in view (the chosen category), and every 7-day piece. */
  total: z.number().int(),
  all_total: z.number().int(),
  categories: z.array(
    z.object({ slug: z.string(), name: z.string(), product_type: z.string(), count: z.number().int() }),
  ),
  products: z.array(productCardSchema),
});
export type QuickPage = z.infer<typeof quickPageSchema>;

/** D-154: the 7-day store's front page (store_quick_front): null while 7-day delivery is off or paused. */
export const quickFrontSchema = z
  .object({
    days_min: z.number().int(),
    days_max: z.number().int(),
    /** The 7-day line ($49.99, Settings): 7-day pieces worth it come in the 7-day days. */
    min_cents: z.number().int().nullable(),
    total: z.number().int(),
    categories: z.array(
      z.object({ slug: z.string(), name: z.string(), count: z.number().int(), image_path: z.string().nullable() }),
    ),
    most_ordered: z.array(productCardSchema),
    under_5: z.array(productCardSchema),
    new_this_week: z.array(productCardSchema),
  })
  .nullable();
export type QuickFront = z.infer<typeof quickFrontSchema>;

export const quickBagSchema = z.object({ days_min: z.number().int(), days_max: z.number().int() }).nullable();
export type QuickBag = z.infer<typeof quickBagSchema>;

/** The 7-day page: one of each category, then the next of each, by price; `category` narrows it. One round trip. */
export async function getQuickPage(
  client: IwcClient,
  filter: { category?: string | null; offset?: number; limit?: number },
): Promise<QuickPage> {
  const data = unwrap(
    await client.rpc(
      'store_quick_browse',
      {
        ...(filter.category ? { p_category: filter.category } : {}),
        p_offset: filter.offset ?? 0,
        p_limit: filter.limit ?? 24,
      },
      { get: true },
    ),
  );
  return quickPageSchema.parse(data);
}

/** D-154: the 7-day store's front page in one round trip (its tiles and rows; the full list is getQuickPage). */
export async function getQuickFront(client: IwcClient): Promise<QuickFront> {
  return quickFrontSchema.parse(unwrap(await client.rpc('store_quick_front', undefined, { get: true })));
}

/** The 7-day days when every piece in the bag is a 7-day piece, else null (one other piece: a normal bag). */
export async function getQuickBag(client: IwcClient, variantIds: string[]): Promise<QuickBag> {
  if (variantIds.length === 0) return null;
  const data = unwrap(await client.rpc('store_quick_bag', { p_variant_ids: variantIds.slice(0, 100) }));
  return quickBagSchema.parse(data);
}

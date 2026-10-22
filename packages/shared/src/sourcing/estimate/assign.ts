import { z } from 'zod';

import { CLASS_LABEL, classGrams, classifyClothing } from './classes';
import { foodNet, netGrams } from './food';

/**
 * D-146: Weights to check → Assign all. admin_weight_plan() names the listings with an option that has no weight;
 * this works out the ones the house rules read (clothing by class, D-132; food by the net quantity its label states,
 * D-135) and leaves the rest (weight_g null) to admin_assign_weights(), which takes the middle weight of the most
 * similar pieces already weighed, else the category's usual weight. Never an option that already has a weight.
 */

export const weightPlanSchema = z.object({
  left: z.number().int(),
  rows: z.array(
    z.object({
      product_id: z.string().uuid(),
      name: z.string(),
      product_type: z.enum(['clothing', 'food', 'home']),
      category_slug: z.string(),
      description: z.string().nullable().catch(null),
      variants: z.array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          options: z.record(z.string()).catch({}),
          weight_g: z.number().int().nullable(),
          weight_source: z.string().nullable(),
          weight_note: z.string().nullable(),
          net_qty: z.string().nullable().catch(null),
          is_active: z.boolean(),
        }),
      ),
    }),
  ),
});
export type WeightPlan = z.infer<typeof weightPlanSchema>;
export type WeightPlanListing = WeightPlan['rows'][number];

export interface WeightAssignment {
  variant_id: string;
  /** null: the database finds it from similar pieces (or the category). */
  weight_g: number | null;
  source?: 'class' | 'packed';
  note?: string;
  net_qty?: string;
}

/** Every option of the plan's listings that has no weight, with the house rule's weight where one reads it. */
export function assignWeights(listings: WeightPlanListing[]): WeightAssignment[] {
  return listings.flatMap((l): WeightAssignment[] => {
    const missing = l.variants.filter((v) => v.weight_g === null);
    if (l.product_type === 'clothing') {
      const found = classifyClothing({ name: l.name, categorySlug: l.category_slug, labels: l.variants.map((v) => v.label) });
      return missing.map((v) =>
        found
          ? {
              variant_id: v.id,
              weight_g: classGrams(found.cls, v.options, l.name),
              source: 'class' as const,
              note: `${CLASS_LABEL[found.cls]}: ${found.why} (D-132)`.slice(0, 200),
            }
          : { variant_id: v.id, weight_g: null },
      );
    }
    if (l.product_type === 'food') {
      return missing.map((v) => {
        const net = foodNet({ name: l.name, description: l.description }, v);
        if (!net) return { variant_id: v.id, weight_g: null };
        return {
          variant_id: v.id,
          weight_g: netGrams(net.parts, l.name),
          source: 'packed' as const,
          note: `${net.label} net (${net.from}) (D-135)`.slice(0, 200),
          net_qty: net.label,
        };
      });
    }
    // home & gifts: its packed weight is on its shop page (D-134, the runner); until then, similar pieces
    return missing.map((v) => ({ variant_id: v.id, weight_g: null }));
  });
}

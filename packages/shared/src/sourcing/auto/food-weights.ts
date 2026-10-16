import { weighFood, type FoodListing } from '../estimate/food';

import type { ListingVariantPayload } from './types';

/**
 * D-133: a new food listing's options are priced on their packed weight from the start: each option's net quantity
 * (its pack, its label, the page's reading, the name) plus its pack, which the page's own spec rows name best
 * ("Package Information: Jar", "Material: Glass"; they are not kept, so this is their one chance). An option whose
 * net quantity nothing states keeps the page's weight; the end of the run tries again (`weighFood` in the runner).
 */
export function packedFoodVariants(
  variants: ListingVariantPayload[],
  page: { name: string; description: string; category: string; specs: [string, string][] },
): ListingVariantPayload[] {
  const listing: FoodListing = {
    product_id: '',
    name: page.name,
    category: page.category,
    description: page.description,
    variants: variants.map((v, i) => ({
      id: String(i),
      label: v.label,
      options: v.options as Record<string, string>,
      weight_g: v.weight_g,
      weight_source: v.weight_g === null ? null : (v.weight_source ?? 'shop'),
      weight_note: v.weight_note ?? null,
      net_qty: null,
    })),
  };
  const results = weighFood(listing, { specs: page.specs });
  return variants.map((v, i) => {
    const r = results[i];
    if (!r?.net || r.grams === null) return v;
    return {
      ...v,
      weight_g: r.grams,
      weight_source: 'packed' as const,
      weight_note: r.note,
      net_qty: r.net.label,
    };
  });
}

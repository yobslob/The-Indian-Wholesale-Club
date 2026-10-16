import { z } from 'zod';

import { PRODUCT_TYPES, type ProductType } from '../../domain/product-types';
import { agreedWeight, bestWeight, readWeights, type WeightReading } from '../weight';

import { words } from './match';

import type { SourcedProduct } from '../capture';

/**
 * D-129: the runner fills the weights listings lack. First the listing's own shop pages (the shop's statement), then
 * the same item on other shops (a matching item: several pages must agree). worker_weight_plan() says what to fill,
 * worker_set_weights() writes it (never over a person's weight).
 */

export const weightPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    product_type: z.enum(PRODUCT_TYPES),
    category_weight_g: z.number().int().nullable(),
    page_url: z.string().nullable(),
    site: z.string().nullable(),
    variants: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        options: z.record(z.string()).catch({}),
        weight_g: z.number().int().nullable(),
        weight_source: z.string().nullable(),
      }),
    ),
    sources: z.array(
      z.object({
        variant_id: z.string().uuid().nullable(),
        site: z.string(),
        page_url: z.string(),
        item_url: z.string(),
        item_key: z.string().nullable(),
      }),
    ),
  }),
);
export type WeightPlan = z.infer<typeof weightPlanSchema>;
export type WeightPlanListing = WeightPlan[number];

export interface WeightWrite {
  variant_id: string;
  weight_g: number;
  source: 'shop' | 'similar';
  note: string;
}

/** The options still wanting a page's weight: none, a matching item's, or an estimate (D-131). */
export const wantsWeight = (v: WeightPlanListing['variants'][number]): boolean =>
  v.weight_g === null || v.weight_source === 'similar' || v.weight_source === 'estimated';

/** A weight a page states for the whole piece (clothing never takes one from its title). */
export function pieceWeight(product: Pick<SourcedProduct, 'title' | 'specs'>, type: ProductType): WeightReading | null {
  const best = bestWeight(readWeights(product));
  if (!best || (type === 'clothing' && best.kind === 'title')) return null;
  return best;
}

/**
 * What a listing's own shop page says: an item's pack for that item's option, else the page's weight for the options
 * that are sizes and colours of one piece (never for a pack it does not name).
 */
export function weightsFromOwnPage(listing: WeightPlanListing, product: SourcedProduct): WeightWrite[] {
  const variantOf = new Map(
    listing.sources.filter((s) => s.item_key && s.variant_id).map((s) => [s.item_key!, s.variant_id!]),
  );
  const out = new Map<string, WeightWrite>();
  for (const item of product.variants) {
    const id = variantOf.get(item.key);
    if (id && item.weightG)
      out.set(id, { variant_id: id, weight_g: item.weightG, source: 'shop', note: `${product.site} item ${item.label}` });
  }
  const piece = pieceWeight(product, listing.product_type);
  if (piece) {
    for (const v of listing.variants) {
      if (!out.has(v.id) && !('pack' in v.options))
        out.set(v.id, { variant_id: v.id, weight_g: piece.grams, source: 'shop', note: `${product.site}: ${piece.note}` });
    }
  }
  const wanted = new Set(listing.variants.filter(wantsWeight).map((v) => v.id));
  return [...out.values()]
    .filter((w) => wanted.has(w.variant_id))
    .map((w) => ({ ...w, note: w.note.slice(0, 200) }));
}

/** Another shop's result is the same item when it has most of the listing's name words (at least two of them). */
export function isSameItem(listingName: string, title: string): boolean {
  const want = [...new Set(words(listingName))];
  if (want.length < 2) return false;
  const have = new Set(words(title));
  return want.filter((w) => have.has(w)).length / want.length >= 0.6;
}

/**
 * The weight matching items on other shops agree on (within 30%), for the options that are sizes and colours of one
 * piece and still want one. A single page is not enough: one seller's typo would become a price.
 */
export function weightsFromSimilar(
  listing: WeightPlanListing,
  found: { site: string; title: string; reading: WeightReading }[],
): WeightWrite[] {
  if (found.length < 2) return [];
  const grams = agreedWeight(found.map((f) => f.reading.grams));
  if (!grams) return [];
  const sites = [...new Set(found.map((f) => f.site))].join(', ');
  // D-133: food pages that agree on the label's net quantity say so, for the packed weight to read it
  const net = listing.product_type === 'food' && found.every((f) => ['net', 'pack', 'title'].includes(f.reading.kind));
  const note = net
    ? `Net quantity: ${grams} g (${found.length} matching items on ${sites} agree)`
    : `${found.length} matching items on ${sites} (${found.map((f) => f.reading.grams).join(', ')} g)`;
  return listing.variants
    .filter((v) => v.weight_g === null && !('pack' in v.options))
    .map((v) => ({ variant_id: v.id, weight_g: grams, source: 'similar' as const, note: note.slice(0, 200) }));
}

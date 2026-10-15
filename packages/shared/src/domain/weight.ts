import type { ProductType } from './product-types';

/**
 * Where an option's weight came from (D-129), strongest first. The price is worked out from the weight (D-128), so
 * a listing goes live only when every option has one of these; an option without one would be priced on the
 * category's usual weight, a guess, and the database refuses to publish it.
 *  - weighed: put on a scale (at the hub, or by an admin with the piece in hand)
 *  - admin: typed by an admin
 *  - shop: stated on the shop's own page (its packed weight, item weight, net quantity, pack or title)
 *  - similar: the same or a matching item on another shop, or another size of the same piece
 */
export const WEIGHT_SOURCES = ['weighed', 'admin', 'shop', 'similar'] as const;
export type WeightSource = (typeof WEIGHT_SOURCES)[number];

export const WEIGHT_SOURCE_LABEL: Record<WeightSource, string> = {
  weighed: 'Weighed',
  admin: 'Entered by an admin',
  shop: "From the shop's page",
  similar: 'From a matching item',
};

/** "450 g", "1.2 kg", "1 kg". */
export function formatGrams(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  return `${Number((grams / 1000).toFixed(grams % 100 === 0 ? 1 : 2))} kg`;
}

export type WeightState = 'confirmed' | 'check' | 'missing';

/**
 * How far an option's weight can be trusted: confirmed (weighed, entered, or the shop's page), check (from a
 * matching item, recorded before sources were kept, or unusual for its category), missing (priced on a guess).
 */
export function weightState(
  v: { weight_g: number | null; weight_source: string | null },
  unusual = false,
): WeightState {
  if (v.weight_g === null) return 'missing';
  if (v.weight_source === 'weighed' || v.weight_source === 'admin') return 'confirmed';
  if (unusual || v.weight_source !== 'shop') return 'check';
  return 'confirmed';
}

/**
 * A clothing or home weight far from its category's usual one (under a quarter or over four times) is more likely
 * a misread page than a real piece. Food packs range too widely for this; their pack is read from the label.
 */
export function unusualWeight(
  grams: number,
  type: ProductType,
  categoryWeightG: number | null,
): boolean {
  if (type === 'food' || !categoryWeightG) return false;
  return grams * 4 < categoryWeightG || grams > categoryWeightG * 4;
}

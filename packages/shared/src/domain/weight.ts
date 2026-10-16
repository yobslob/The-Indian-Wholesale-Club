import type { ProductType } from './product-types';

/**
 * Where an option's weight came from (D-129), strongest first. The price is worked out from the weight (D-128), so
 * a listing goes live only when every option has one of these; an option without one would be priced on the
 * category's usual weight, a guess, and the database refuses to publish it.
 *  - weighed: put on a scale (at the hub, or by an admin with the piece in hand)
 *  - admin: typed by an admin
 *  - shop: stated on the shop's own page (its packed weight, item weight, net quantity, pack or title)
 *  - similar: the same or a matching item on another shop, or another size of the same piece
 *  - estimated: the weight estimator on the founder's laptop, when it is sure (D-131); a page or the scale replaces it
 *  - class: clothing by the founder's four classes, light 350 g to heavy 1.5 kg (D-132); the scale replaces it
 *  - packed: food's net quantity as its label states it (D-135; D-133 added its pack), a home piece's own weight plus
 *    its packing (D-134); the scale or an admin replaces it
 */
export const WEIGHT_SOURCES = [
  'weighed',
  'admin',
  'shop',
  'similar',
  'estimated',
  'class',
  'packed',
] as const;
export type WeightSource = (typeof WEIGHT_SOURCES)[number];

export const WEIGHT_SOURCE_LABEL: Record<WeightSource, string> = {
  weighed: 'Weighed',
  admin: 'Entered by an admin',
  shop: "From the shop's page",
  similar: 'From a matching item',
  estimated: 'Estimated (weight estimator)',
  class: 'Clothing class (D-132)',
  packed: 'Its weight + its packing (D-134)',
};

/** The source as admins read it: food's "packed" weight is its label's net weight since D-135 (no packaging). */
export function weightSourceLabel(source: WeightSource, type: ProductType): string {
  return source === 'packed' && type === 'food'
    ? 'Net weight on its label (D-135)'
    : WEIGHT_SOURCE_LABEL[source];
}

/** "450 g", "1.2 kg", "1 kg". */
export function formatGrams(grams: number): string {
  if (grams < 1000) return `${Math.round(grams)} g`;
  return `${Number((grams / 1000).toFixed(grams % 100 === 0 ? 1 : 2))} kg`;
}

export type WeightState = 'confirmed' | 'check' | 'missing';

/**
 * How far an option's weight can be trusted: confirmed (weighed, entered, the shop's page, or a sure estimate,
 * D-131), check (from a matching item, recorded before sources were kept, unusual for its category, or a shop's
 * weight the estimator disagrees with), missing (priced on a guess).
 */
export function weightState(
  v: { weight_g: number | null; weight_source: string | null },
  unusual = false,
): WeightState {
  if (v.weight_g === null) return 'missing';
  // a class weight is the founder's rule (D-132), a packed one the label's net plus its pack (D-133)
  if (['weighed', 'admin', 'class', 'packed'].includes(v.weight_source ?? '')) return 'confirmed';
  if (unusual || (v.weight_source !== 'shop' && v.weight_source !== 'estimated')) return 'check';
  return 'confirmed';
}

/**
 * D-131: the estimator's weight is more than a third away from the shop's stated one (a saffron box the page calls
 * 1 g), so an admin looks. The same rule as the database's Weights to check.
 */
export function estimateDisagrees(v: {
  weight_g: number | null;
  weight_source: string | null;
  weight_estimate_g?: number | null;
}): boolean {
  return (
    v.weight_source === 'shop' &&
    v.weight_g !== null &&
    v.weight_estimate_g != null &&
    Math.abs(v.weight_estimate_g - v.weight_g) * 3 > v.weight_g
  );
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

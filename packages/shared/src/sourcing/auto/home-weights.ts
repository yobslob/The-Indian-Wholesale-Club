import { homeWeight } from '../estimate/home';

import { itemKeyOf } from './listing';

import type { SourcedProduct } from '../capture';
import type { ListingVariantPayload } from './types';

/**
 * D-134: a new home listing's weight is the one its page states for the item the page is about (Amazon's own ASIN),
 * checked and with its packing (`homeWeight`). Its other sizes and colours are separate items with their own pages
 * and weights: they start without one (the database lends them the page item's, marked similar) and the end of the
 * run reads each one's own page (`weighHome` in the runner).
 */
export function homeVariants(
  variants: ListingVariantPayload[],
  product: Pick<SourcedProduct, 'url' | 'title' | 'specs'>,
): ListingVariantPayload[] {
  const own = itemKeyOf(product.url);
  const pageItem = variants.length === 1 ? variants[0] : variants.find((v) => v.item_key === own);
  const w = homeWeight(product);
  return variants.map((v) => {
    const { weight_source: _s, weight_note: _n, ...rest } = v;
    if (v === pageItem && w.grams && w.source)
      return { ...rest, weight_g: w.grams, weight_source: w.source, weight_note: w.note };
    return { ...rest, weight_g: null };
  });
}

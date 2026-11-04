import type { Tone } from '@repo/shared/admin';

interface Draftish {
  product_type: string;
  shop_price_paise: number | null;
  media: unknown[];
  variants: { qty_listed: number; is_active: boolean }[];
}

/**
 * What a draft still needs before it can go live (D-097: drafts show it on their card): a photo, the shop price and
 * pieces.
 */
export function listingNeeds(p: Draftish): [string, Tone] {
  if (p.media.length === 0) return ['Needs a photo', 'warn'];
  if (p.shop_price_paise === null) return ['Needs a shop price', 'warn'];
  if (!p.variants.some((v) => v.is_active && v.qty_listed > 0)) return ['Needs pieces', 'warn'];
  return ['Ready to publish', 'ok'];
}

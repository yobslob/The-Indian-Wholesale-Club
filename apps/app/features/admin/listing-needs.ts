import type { Tone } from '@repo/shared/admin';

interface Draftish {
  product_type: string;
  shop_price_paise: number | null;
  media: unknown[];
  variants: { qty_listed: number; is_active: boolean }[];
}

/**
 * What a draft still needs before it can go live (D-097: drafts show it on their card). Spices can't go live yet
 * (D-032); a photo, the shop price (what the shop is paid, D-005) and pieces are needed.
 */
export function listingNeeds(p: Draftish): [string, Tone] {
  if (p.product_type === 'spice') return ['Spices can’t go live yet', 'mute'];
  if (p.media.length === 0) return ['Needs a photo', 'warn'];
  if (p.shop_price_paise === null) return ['Needs a shop price', 'warn'];
  if (!p.variants.some((v) => v.is_active && v.qty_listed > 0)) return ['Needs pieces', 'warn'];
  return ['Ready to publish', 'ok'];
}

import { formatUsd } from '@repo/shared/domain';

import type { CardOption, ProductCard } from '@repo/db/store';

/**
 * The card's options as the + offers them (D-140, plan F9): pure, so the picker and its tests share it.
 * Clothing reads as its size ("M"), food and home & gifts as their pack, flavour or type with its own price
 * ("200 g · $4.29"); a piece in colours picks the colour first.
 */
export const LOW_STOCK = 3;

/** The chip's words for an option. */
export function chipLabel(o: CardOption, type: ProductCard['product_type'], showPrice: boolean): string {
  const opt = o.options ?? {};
  const base = type === 'clothing' ? (opt.size ?? opt.pack ?? o.label) : (opt.pack ?? opt.flavour ?? opt.style ?? opt.size ?? o.label);
  return showPrice ? `${base} · ${formatUsd(o.price_cents)}` : base;
}

/** The colours a piece comes in (two or more), in their order; empty when it has one or none. */
export function coloursOf(options: CardOption[]): string[] {
  const seen: string[] = [];
  for (const o of options) {
    const c = o.options?.colour;
    if (c && !seen.includes(c)) seen.push(c);
  }
  return seen.length > 1 ? seen : [];
}

/** Whether the chips should name their prices: food and home & gifts, or any piece whose options differ in price. */
export function showsPrices(options: CardOption[], type: ProductCard['product_type']): boolean {
  return type !== 'clothing' || new Set(options.map((o) => o.price_cents)).size > 1;
}

/** The bag line for an option. */
export function bagLine(
  product: Pick<ProductCard, 'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'> & { product_type?: string },
  o: Pick<CardOption, 'id' | 'label' | 'price_cents'>,
) {
  return {
    variantId: o.id,
    productId: product.id,
    productName: product.name,
    productSlug: product.slug,
    regionSlug: product.region_slug,
    regionName: product.region_name,
    variantLabel: o.label,
    unitPriceCents: o.price_cents,
    imagePath: product.primary_image_path,
    ...(product.product_type ? { productType: product.product_type } : {}),
  };
}

const loading = new Map<string, Promise<CardOption[]>>();

/**
 * A card's options when the page kept them out (D-145, slim-cards.ts): read once per piece from /api/card-options and
 * kept for the visit; a failed read is forgotten, so the next press tries again.
 */
export function loadCardOptions(productId: string): Promise<CardOption[]> {
  let pending = loading.get(productId);
  if (!pending) {
    pending = fetch(`/api/card-options?id=${encodeURIComponent(productId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((list: unknown) => {
        if (!Array.isArray(list)) throw new Error('not a list');
        return list as CardOption[];
      });
    pending.catch(() => loading.delete(productId));
    loading.set(productId, pending);
  }
  return pending;
}

/** The most chips the ribbon shows at one step: the colours, then one colour's sizes. */
export function ribbonWidth(options: CardOption[]): number {
  const colours = coloursOf(options);
  if (colours.length === 0) return options.length;
  return Math.max(colours.length, ...colours.map((c) => options.filter((o) => o.options?.colour === c).length));
}

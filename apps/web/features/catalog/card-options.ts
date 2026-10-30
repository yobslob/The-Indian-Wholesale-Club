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
  product: Pick<ProductCard, 'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'> & {
    product_type?: string;
    quick_days?: number | null;
  },
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
    // the bag's goal knows a 7-day piece from the add, before its answer comes (bag-goal.ts)
    quick: product.quick_days != null,
  };
}

const loading = new Map<string, Promise<CardOption[]>>();

// Cards seen on screen wait here a moment, then go as one read (preloadCardOptions)
const waiting = new Map<
  string,
  { resolve: (list: CardOption[]) => void; reject: (error: unknown) => void }
>();
let queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const BATCH = 48;

function flush(): void {
  timer = null;
  const all = queue;
  queue = [];
  for (let i = 0; i < all.length; i += BATCH) {
    const ids = all.slice(i, i + BATCH);
    const settle = (answer: Record<string, unknown> | null, error?: unknown): void => {
      for (const id of ids) {
        const w = waiting.get(id);
        waiting.delete(id);
        const list = answer?.[id];
        if (Array.isArray(list)) w?.resolve(list as CardOption[]);
        else w?.reject(error ?? new Error('missing'));
      }
    };
    fetch(`/api/card-options?ids=${ids.join(',')}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((answer: unknown) =>
        settle(
          typeof answer === 'object' && answer !== null
            ? (answer as Record<string, unknown>)
            : null,
        ),
      )
      .catch((error: unknown) => settle(null, error));
  }
}

/**
 * A several-option card came on screen (2026-10-30): its options are read now, with every other card that came on
 * screen in the same moment (one request, not one per card), so its + opens at once instead of after a read. A failed
 * read is forgotten, so the press reads again on its own.
 */
export function preloadCardOptions(productId: string): void {
  if (loading.has(productId)) return;
  const pending = new Promise<CardOption[]>((resolve, reject) =>
    waiting.set(productId, { resolve, reject }),
  );
  pending.catch(() => loading.delete(productId));
  loading.set(productId, pending);
  queue.push(productId);
  timer ??= setTimeout(flush, 120);
}

/**
 * A card's options when the page kept them out (D-145, slim-cards.ts): read once per piece from /api/card-options (or
 * already on its way from preloadCardOptions) and kept for the visit; a failed read is forgotten, so the next press
 * tries again.
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

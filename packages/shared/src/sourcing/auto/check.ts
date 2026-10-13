import { oneLine } from '../text';

import { itemKeyOf } from './listing';

import type { SourcedProduct, SourcedVariant } from '../capture';
import type { CheckSource } from './types';

/**
 * The weekly check of one page (D-118): each source on it finds its item among what the page shows (by the shop's id,
 * or by its label for listings imported by hand), and items the page has that no source knows (a new flavour or
 * pack) are reported as added. The database decides what changes (worker_sourcing_checked). Pure, no I/O.
 */

export interface SourceResult {
  id: string;
  ok: boolean;
  item_key?: string;
  price_paise?: number | null;
  mrp_paise?: number | null;
  in_stock?: boolean;
  delivery_days?: number | null;
  error?: string;
}

export interface AddedItem {
  site: string;
  page_url: string;
  item_url: string;
  item_key: string;
  label: string;
  options: SourcedVariant['options'];
  price_paise: number;
  mrp_paise: number | null;
  in_stock: boolean;
  delivery_days: number | null;
  weight_g: number | null;
}

const norm = (s: string): string => oneLine(s).toLowerCase();

/** The page's items; a page without variants is one item. */
export function pageItems(product: SourcedProduct): SourcedVariant[] {
  if (product.variants.length) return product.variants;
  return [
    {
      key: itemKeyOf(product.url),
      url: product.url,
      label: 'One size',
      options: {},
      pricePaise: product.pricePaise,
      mrpPaise: product.mrpPaise,
      inStock: product.inStock,
      weightG: null,
      image: null,
    },
  ];
}

export function checkPage(
  sources: CheckSource[],
  product: SourcedProduct | null,
  pageDays: number | null,
  error?: string,
): { results: SourceResult[]; added: AddedItem[] } {
  if (!product)
    return {
      results: sources.map((s) => ({ id: s.id, ok: false, error: error ?? 'unread' })),
      added: [],
    };
  const items = pageItems(product);
  const used = new Set<string>();
  const results = sources.map((s): SourceResult => {
    const item =
      (s.item_key ? items.find((i) => i.key === s.item_key) : undefined) ??
      (!s.item_key
        ? items.length === 1
          ? items[0]
          : items.find(
              (i) =>
                norm(i.label) === norm(s.label) || norm(i.options.size ?? '') === norm(s.label),
            )
        : undefined);
    if (!item) return { id: s.id, ok: false, error: 'item no longer on the page' };
    used.add(item.key);
    if (item.pricePaise === null) return { id: s.id, ok: false, error: 'no price shown' };
    return {
      id: s.id,
      ok: true,
      item_key: item.key,
      price_paise: item.pricePaise,
      mrp_paise: item.mrpPaise,
      // a price with no word on stock means it sells
      in_stock: item.inStock !== false,
      delivery_days: pageDays,
    };
  });
  // new items only on a page whose items the listing already follows by id (a family page)
  const follows = sources.some((s) => s.item_key && items.some((i) => i.key === s.item_key));
  const known = new Set(sources.map((s) => s.item_key).filter(Boolean));
  const added = follows
    ? items
        .filter((i) => !used.has(i.key) && !known.has(i.key) && i.pricePaise && i.inStock !== false)
        .map((i) => ({
          site: product.site,
          page_url: product.url,
          item_url: i.url,
          item_key: i.key,
          label: i.label,
          options: i.options,
          price_paise: i.pricePaise!,
          mrp_paise: i.mrpPaise,
          in_stock: true,
          delivery_days: pageDays,
          weight_g: i.weightG,
        }))
    : [];
  return { results, added };
}

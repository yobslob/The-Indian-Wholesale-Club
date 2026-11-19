import { z } from 'zod';

import { formatGrams } from '../../domain/weight';
import { words } from '../auto/match';

import type { EstimateWrite } from './plan';

/**
 * D-202, the price check: a food estimate is far off when the shop's price for it makes a kilo cost several times
 * what similar items with a label weight cost (Deepak Jau Sattu at ₹87 for "140 g" is ₹621 a kilo; barley flours with
 * a label cost about ₹180). Such an estimate becomes the shop's price ÷ what similar items cost a gram, rounded to a
 * pack size packs come in (500 g). Only estimates (and options with no weight) change, never a weight read from a
 * label or page, weighed or typed; customers do not see the result (D-202), the price does (D-128). The label reader
 * (`pnpm weights labels`) comes first; this is the net for what it cannot read. worker_food_prices() feeds it,
 * worker_set_estimates() writes it.
 */

export const foodPricesSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    variants: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          weight_g: z.number().int().nullable(),
          weight_source: z.string().nullable(),
          net_qty: z.string().nullable().catch(null),
          is_active: z.boolean(),
          shop_price_paise: z.number().int().nullable(),
        }),
      )
      .nullable()
      .transform((v) => v ?? []),
  }),
);
export type FoodPriceListing = z.infer<typeof foodPricesSchema>[number];

/** Weights someone read or weighed: the label (packed), the hub's scale, an admin. */
const TRUSTED = new Set(['packed', 'weighed', 'admin']);

/** Sizes packs come in, in grams: an answer is rounded to the nearest (by ratio). */
export const PACK_SIZES = [
  10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 125, 150, 160, 175, 180, 200, 225, 250, 300,
  350, 400, 450, 500, 600, 700, 750, 800, 900, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000,
] as const;

/** The sizes most packs come in: within a fifth of one, it is that one (₹87 at ₹185 a kg is 470 g: a 500 g pack). */
const COMMON_SIZES = [50, 100, 200, 250, 500, 1000, 2000, 5000];

export function snapToPack(grams: number): number {
  const nearest = (sizes: readonly number[]): number =>
    sizes.reduce((best, size) =>
      Math.abs(Math.log(size / grams)) < Math.abs(Math.log(best / grams)) ? size : best,
    );
  const common = nearest(COMMON_SIZES);
  return Math.abs(Math.log(common / grams)) <= Math.log(1.2) ? common : nearest(PACK_SIZES);
}

/** The words that say what an item is: no numbers, units or two-letter scraps. */
const itemWords = (name: string): string[] => [
  ...new Set(words(name).filter((w) => w.length > 2 && !/\d/.test(w))),
];

interface Reference {
  product_id: string;
  name: string;
  category: string;
  words: Set<string>;
  /** Rupees a kilo. */
  perKg: number;
}

export interface PriceCheckRow {
  listing: FoodPriceListing;
  variant: FoodPriceListing['variants'][number];
  perKg: number | null;
  similar: { count: number; perKg: number; names: string[] } | null;
  grams: number | null;
  /** changed, kept (in line with similar items), or why nothing could be said. */
  result:
    'changed' | 'kept' | 'no similar labelled items' | 'similar items disagree' | 'no shop price';
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.sqrt(s[m - 1]! * s[m]!);
};

/** The references: every active option weighed by someone, with its shop price, as rupees a kilo. */
export function priceReferences(listings: FoodPriceListing[]): Reference[] {
  const out: Reference[] = [];
  for (const l of listings) {
    const w = new Set(itemWords(l.name));
    if (w.size < 2) continue;
    for (const v of l.variants) {
      if (!v.is_active || !TRUSTED.has(v.weight_source ?? '') || !v.weight_g || !v.shop_price_paise)
        continue;
      out.push({
        product_id: l.product_id,
        name: l.name,
        category: l.category,
        words: w,
        perKg: (v.shop_price_paise / v.weight_g) * 10,
      });
    }
  }
  return out;
}

/** An index from each word to the references that have it. */
export function indexReferences(refs: Reference[]): Map<string, Reference[]> {
  const index = new Map<string, Reference[]>();
  for (const r of refs) for (const w of r.words) index.set(w, [...(index.get(w) ?? []), r]);
  return index;
}

/** The labelled items most like this name: at least two words and half of its words shared, its category first. */
export function similarReferences(
  listing: Pick<FoodPriceListing, 'product_id' | 'name' | 'category'>,
  index: Map<string, Reference[]>,
  most = 7,
): Reference[] {
  const mine = itemWords(listing.name);
  const shared = new Map<Reference, number>();
  for (const w of mine)
    for (const r of index.get(w) ?? [])
      if (r.product_id !== listing.product_id) shared.set(r, (shared.get(r) ?? 0) + 1);
  return [...shared.entries()]
    .filter(([, n]) => n >= 2 && n * 2 >= mine.length)
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        Number(b[0].category === listing.category) - Number(a[0].category === listing.category),
    )
    .slice(0, most)
    .map(([r]) => r);
}

/** Every estimated option of these listings, checked against what similar labelled items cost a kilo. */
export function checkPrices(
  listings: FoodPriceListing[],
  index: Map<string, Reference[]>,
): PriceCheckRow[] {
  const rows: PriceCheckRow[] = [];
  for (const listing of listings) {
    const wanted = listing.variants.filter(
      (v) => v.is_active && (v.weight_g === null || v.weight_source === 'estimated'),
    );
    if (!wanted.length) continue;
    const near = similarReferences(listing, index);
    const per = near.map((r) => r.perKg);
    const similar = near.length
      ? { count: near.length, perKg: median(per), names: near.slice(0, 3).map((r) => r.name) }
      : null;
    for (const variant of wanted) {
      const row: PriceCheckRow = {
        listing,
        variant,
        perKg: null,
        similar,
        grams: null,
        result: 'kept',
      };
      rows.push(row);
      if (!variant.shop_price_paise) {
        row.result = 'no shop price';
        continue;
      }
      if (variant.weight_g) row.perKg = (variant.shop_price_paise / variant.weight_g) * 10;
      if (!similar || similar.count < 3) {
        row.result = 'no similar labelled items';
        continue;
      }
      // similar items a kilo apart by more than four times say nothing about this one
      if (Math.max(...per) > Math.min(...per) * 4) {
        row.result = 'similar items disagree';
        continue;
      }
      const ratio = row.perKg === null ? Infinity : row.perKg / similar.perKg;
      if (ratio >= 0.5 && ratio <= 2) continue;
      const grams = snapToPack((variant.shop_price_paise / 100 / similar.perKg) * 1000);
      // a pack size within a third of today's weight is no correction
      if (variant.weight_g && Math.abs(grams - variant.weight_g) * 3 <= variant.weight_g) continue;
      row.grams = grams;
      row.result = 'changed';
    }
  }
  return rows;
}

const rupees = (paise: number): string => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

/** The estimates to write: each changed option's new weight, sure (it replaces the old estimate), with why. */
export function priceCheckWrites(rows: PriceCheckRow[]): EstimateWrite[] {
  return rows.flatMap((r) =>
    r.result === 'changed' && r.grams && r.similar && r.variant.shop_price_paise
      ? [
          {
            variant_id: r.variant.id,
            weight_g: r.grams,
            sure: true,
            note: `Price check (D-202): ${rupees(r.variant.shop_price_paise)}${
              r.perKg ? ` is ₹${Math.round(r.perKg)} a kg` : ''
            }; ${r.similar.count} similar labelled items ₹${Math.round(r.similar.perKg)} a kg → ${formatGrams(r.grams)}`,
          },
        ]
      : [],
  );
}

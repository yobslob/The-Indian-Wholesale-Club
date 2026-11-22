import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { autoPrice, formatGrams } from '@repo/shared/domain';
import {
  checkPrices,
  indexReferences,
  priceCheckWrites,
  priceReferences,
  similarReferences,
  type FoodPriceListing,
  type LabelListing,
  type PriceCheckRow,
} from '@repo/shared/sourcing/estimate';

import { log, ROOT } from './env';

import type { Db } from './db';

/**
 * D-202: `pnpm weights prices` checks every food estimate against what similar labelled items cost a kilo
 * (packages/shared/src/sourcing/estimate/price-check.ts). One far off becomes the shop's price ÷ their price a gram,
 * rounded to a pack size, as a sure estimate (worker_set_estimates: never over a weight read, weighed or typed).
 * Customers do not see it (D-202); the price follows (D-128). Run it after the label reader. No model, no GPU.
 *   --dry   write the sheet price-check.csv only
 */

type PriceIndex = ReturnType<typeof indexReferences>;

/** Every food listing, 500 a call (about 30 calls for the catalogue). */
async function allFood(db: Db): Promise<FoodPriceListing[]> {
  const out: FoodPriceListing[] = [];
  for (let after: string | null = null; ;) {
    const page = await db.foodPrices(after);
    if (!page.length) return out;
    out.push(...page);
    after = page[page.length - 1]!.product_id;
  }
}

export async function loadPriceIndex(db: Db): Promise<PriceIndex> {
  const refs = priceReferences(await allFood(db));
  log(`price check: ${refs.length} options with a weight read or weighed, as references`);
  return indexReferences(refs);
}

/**
 * For the label reader: a label weight that makes a kilo cost LABEL_DEARER times more than similar items, or four
 * times less, is doubted. Dearer is the side one pack's label on a listing of several packs falls on (the eval of
 * 2026-11-20: Chitale's 1.2 kg read as 400 g, three times dearer), and it would price the listing below its cost.
 * TODO(founder): Q-62 confirms the limit (Claude's, from the eval).
 */
export const LABEL_DEARER = 1.8;

export function priceDoubt(index: PriceIndex) {
  return (
    listing: LabelListing,
    variant: LabelListing['variants'][number],
    grams: number,
  ): string | null => {
    if (!variant.shop_price_paise) return null;
    const near = similarReferences(listing, index);
    if (near.length < 3) return null;
    const perKg = (variant.shop_price_paise / grams) * 10;
    const typical = near.map((r) => r.perKg).sort((a, b) => a - b)[Math.floor(near.length / 2)]!;
    return perKg > typical * LABEL_DEARER || perKg < typical / 4
      ? `₹${Math.round(perKg)} a kg; similar labelled items ₹${Math.round(typical)}`
      : null;
  };
}

const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
const usd = (cents: number | null | undefined): string =>
  cents == null ? '' : `$${(cents / 100).toFixed(2)}`;

export async function checkFoodPrices(db: Db, opts: { dry: boolean }): Promise<number> {
  const started = Date.now();
  const food = await allFood(db);
  const index = indexReferences(priceReferences(food));
  const rows = checkPrices(food, index);
  const writes = priceCheckWrites(rows);
  let written = 0;
  if (!opts.dry && writes.length) {
    appendFileSync(
      join(ROOT, 'price-check-before.jsonl'),
      rows
        .filter((r) => r.result === 'changed')
        .map((r) =>
          JSON.stringify({
            at: new Date().toISOString(),
            product_id: r.listing.product_id,
            variant: r.variant,
          }),
        )
        .join('\n') + '\n',
    );
    for (let i = 0; i < writes.length; i += 500)
      written += (await db.setEstimates(writes.slice(i, i + 500))).weights;
  }
  const sheet = join(ROOT, 'price-check.csv');
  writeSheet(sheet, rows);
  const count = (r: PriceCheckRow['result']) => rows.filter((x) => x.result === r).length;
  log(
    `price check: ${food.length} food listings, ${rows.length} estimated options in ${((Date.now() - started) / 1000).toFixed(1)} s: ` +
      `${count('changed')} far from similar labelled items, ${count('kept')} in line, ${count('no similar labelled items')} without ` +
      `three similar labelled items, ${count('similar items disagree')} where they disagree. Sheet: ${sheet}. ` +
      (opts.dry ? 'Nothing written (--dry).' : `${written} weights written.`),
  );
  return 0;
}

function writeSheet(file: string, rows: PriceCheckRow[]): void {
  const head = [
    'Listing',
    'Category',
    'Option',
    'Shop ₹',
    'Weight before',
    '₹ a kg',
    'Similar items',
    'Their ₹ a kg',
    'Like',
    'New weight',
    'Price before',
    'Price after',
    'Result',
  ];
  const price = (paise: number | null, g: number | null) =>
    paise && g
      ? usd(autoPrice({ shopPricePaise: paise, weightG: g, productType: 'food' })?.priceCents)
      : '';
  const lines = rows
    .sort(
      (a, b) =>
        Number(b.result === 'changed') - Number(a.result === 'changed') ||
        a.listing.name.localeCompare(b.listing.name),
    )
    .map((r) =>
      [
        r.listing.name,
        r.listing.category,
        r.variant.label,
        r.variant.shop_price_paise ? Math.round(r.variant.shop_price_paise / 100) : '',
        r.variant.weight_g ? formatGrams(r.variant.weight_g) : '',
        r.perKg ? Math.round(r.perKg) : '',
        r.similar?.count ?? '',
        r.similar ? Math.round(r.similar.perKg) : '',
        r.similar?.names.join(' | ') ?? '',
        r.grams ? formatGrams(r.grams) : '',
        price(r.variant.shop_price_paise, r.variant.weight_g),
        r.grams ? price(r.variant.shop_price_paise, r.grams) : '',
        r.result,
      ]
        .map(cell)
        .join(','),
    );
  writeFileSync(file, `\uFEFF${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
}

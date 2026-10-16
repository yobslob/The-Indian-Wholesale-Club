import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatGrams } from '@repo/shared/domain';
import { weighAllFood, type FoodListing } from '@repo/shared/sourcing/estimate';

import { log, ROOT } from './env';

import type { Db } from './db';

/**
 * D-133, D-135: `pnpm weights food` gives every food option its real weight: the net quantity its label states,
 * unit by unit, no packaging (packages/shared/src/sourcing/estimate/food.ts), never over the hub's scale or an
 * admin's weight. Rules only, no model. The sheet food-weights.csv (for Excel) has every option: its net quantity,
 * where it was read, the weight it had and the new one; "Look at it" marks a weight that moves by more than a third
 * and an option no label states.
 */

export const FOOD_SHEET = join(ROOT, 'food-weights.csv');
const BEFORE = join(ROOT, 'food-weights-before.jsonl');

const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
const grams = (g: number | null): string => (g === null ? '' : formatGrams(g));

/** Before writing, every option's weight as it was (not in git): what an admin or a script needs to put one back. */
function keepBefore(page: FoodListing[]): void {
  appendFileSync(
    BEFORE,
    page
      .map((l) =>
        JSON.stringify({
          at: new Date().toISOString(),
          product_id: l.product_id,
          name: l.name,
          variants: l.variants.map((v) => ({
            id: v.id,
            label: v.label,
            weight_g: v.weight_g,
            weight_source: v.weight_source,
            weight_note: v.weight_note,
            net_qty: v.net_qty,
          })),
        }),
      )
      .join('\n') + '\n',
  );
}

export async function weighFood(db: Db, opts: { dry: boolean; all: boolean }): Promise<number> {
  const started = Date.now();
  const pass = await weighAllFood(db, { ...opts, keep: keepBefore, log });
  const head = [
    'Listing',
    'Category',
    'Option',
    'Net quantity',
    'Read from',
    'Weight before',
    'Source before',
    'New weight',
    'Change',
    'Look at it',
  ];
  const lines = pass.rows
    .sort(
      (a, b) =>
        a.listing.category.localeCompare(b.listing.category) ||
        a.listing.name.localeCompare(b.listing.name),
    )
    .map(({ listing, result: r }) => {
      const before = r.variant.weight_g;
      const now = r.grams ?? before;
      const change =
        before && now && now !== before
          ? `${now > before ? '+' : ''}${Math.round(((now - before) * 100) / before)}%`
          : '';
      return [
        listing.name,
        listing.category,
        r.variant.label,
        r.net?.label ?? '',
        r.net?.from ?? '',
        grams(before),
        r.variant.weight_source ?? '',
        r.grams === null ? `${grams(before)} (kept)` : grams(r.grams),
        change,
        r.look ?? '',
      ]
        .map(cell)
        .join(',');
    });
  // a byte-order mark so Excel reads the × and ₹ in names
  if (lines.length)
    writeFileSync(FOOD_SHEET, `﻿${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
  const look = pass.rows.filter((r) => r.result.look).length;
  log(
    `food: ${pass.listings} listings, ${pass.options} options in ${((Date.now() - started) / 1000).toFixed(1)} s; ` +
      `${pass.noNet} state no net quantity (kept as they are); ${look} marked to look at` +
      `. Sheet: ${FOOD_SHEET}. ` +
      (opts.dry ? 'Nothing written (--dry).' : `${pass.written} options written.`),
  );
  return 0;
}

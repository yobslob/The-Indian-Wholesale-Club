import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLASS_ANSWER_SCHEMA,
  CLASS_GRAMS,
  CLASS_SYSTEM,
  classifyClothing,
  classPrompt,
  classWrites,
  readClass,
  type ClassWrite,
  type ClothingClass,
  type ClothingListing,
} from '@repo/shared/sourcing/estimate';

import { errorText, log, ROOT } from './env';
import { pool } from './estimate';

import type { Db } from './db';
import type { Ollama } from './ollama';

/**
 * D-132: `pnpm weights classes` gives every clothing listing its class weight (light 350 g, medium 750 g, pants and
 * footwear 800 g, heavy 1.5 kg). The name rules decide (packages/shared/src/sourcing/estimate/classes.ts), then the
 * category; the local model only sorts a name neither reads (asked about every listing, it put sets in medium and
 * shoes in heavy against the founder's lists). The sheet (clothing-classes.csv, for Excel) marks what was sorted by
 * category or by the model; the founder looks at it before writing.
 */

export const SHEET = join(ROOT, 'clothing-classes.csv');
const BEFORE = join(ROOT, 'clothing-classes-before.jsonl');

interface Row {
  name: string;
  category: string;
  cls: ClothingClass | null;
  why: string;
  by: string;
}

const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

function writeSheet(rows: Row[]): void {
  const head = ['Listing', 'Category', 'Class', 'Grams', 'Why', 'Decided by', 'Look at it'];
  const lines = rows.map((r) =>
    [
      r.name,
      r.category,
      r.cls ?? 'not sorted',
      r.cls ? CLASS_GRAMS[r.cls] : '',
      r.why,
      r.by,
      r.by === 'rule (name)' ? '' : 'yes',
    ]
      .map(cell)
      .join(','),
  );
  // a byte-order mark so Excel reads the ’ and ₹ in names
  writeFileSync(SHEET, `﻿${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
}

/**
 * Before writing, every option's weight as it was, one JSON line per listing in clothing-classes-before.jsonl (not in
 * git): what an admin or a script needs to put a weight back.
 */
function keepBefore(page: ClothingListing[]): void {
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
          })),
        }),
      )
      .join('\n') + '\n',
  );
}

async function modelView(
  ollama: Ollama,
  listing: ClothingListing,
): Promise<{ cls: ClothingClass; why: string } | null> {
  try {
    return readClass(
      (await ollama.ask(CLASS_SYSTEM, classPrompt(listing), CLASS_ANSWER_SCHEMA)).content,
    );
  } catch {
    return null;
  }
}

export async function sortClothing(
  db: Db,
  ollama: Ollama | null,
  opts: { dry: boolean; all: boolean; parallel: number },
): Promise<number> {
  const started = Date.now();
  const rows: Row[] = [];
  const count: Record<string, number> = {};
  let after: string | null = null;
  let written = 0;
  for (;;) {
    const page = await db.clothingPlan(after, opts.all);
    if (!page.length) break;
    after = page[page.length - 1]!.product_id;
    if (!opts.dry) keepBefore(page);
    const writes: ClassWrite[] = [];
    await pool(page, opts.parallel, async (listing) => {
      const rule = classifyClothing({
        name: listing.name,
        categorySlug: listing.category_slug,
        labels: listing.variants.map((v) => v.label),
      });
      const model = !rule && ollama ? await modelView(ollama, listing) : null;
      const cls = rule?.cls ?? model?.cls ?? null;
      const why = rule?.why ?? (model ? `the model: ${model.why}` : 'no rule reads its name');
      const by = rule ? `rule (${rule.by})` : model ? 'model' : '';
      rows.push({ name: listing.name, category: listing.category, cls, why, by });
      count[cls ?? 'not sorted'] = (count[cls ?? 'not sorted'] ?? 0) + 1;
      if (cls) writes.push(...classWrites(listing, cls, why));
    });
    for (let i = 0; !opts.dry && i < writes.length; i += 500)
      written += await db.setClassWeights(writes.slice(i, i + 500)).catch((error: unknown) => {
        log(`  writing failed: ${errorText(error)}`);
        return 0;
      });
    log(`  ${rows.length} clothing listings read`);
  }
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  // nothing left to sort: keep the last sheet rather than an empty one (--all writes it again in full)
  if (rows.length) writeSheet(rows);
  const look = rows.filter((r) => r.by !== 'rule (name)').length;
  log(
    `classes: ${rows.length} listings in ${((Date.now() - started) / 1000).toFixed(0)} s: ` +
      Object.entries(count)
        .map(([k, n]) => `${n} ${k}`)
        .join(', ') +
      `; ${look} sorted by category or the model, marked to look at` +
      `. Sheet: ${SHEET}. ` +
      (opts.dry ? 'Nothing written (--dry).' : `${written} options got their class weight.`),
  );
  return 0;
}

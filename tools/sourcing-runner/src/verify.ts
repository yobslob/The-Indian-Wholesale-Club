import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  checkPage,
  checkWeight,
  nameFromTitle,
  pageItems,
  pagePack,
  type SourceResult,
  type VerifyListing,
} from '@repo/shared/sourcing/auto';

import { readPage } from './check';
import { ROOT } from './env';
import { errorText, log } from './log';

import type { RunContext } from './context';
import type { PageRead } from './shops';
import type { FoodWrite } from '@repo/shared/sourcing/estimate';

/**
 * `pnpm sourcing verify` (founder, 2026-11-27: a 900 g oats pack priced on "27g High Protein", a Bikaneri sev named
 * "Samrat", and live pieces no shop sells any more). Each listing's own shop pages are read once, and what they show
 * decides three things:
 *  - stock and price, through the existing check (worker_sourcing_checked, D-118): an option no shop has in stock is
 *    sold out, so its add button says "Sold out" and checkout refuses it (always written, except with --dry);
 *  - the pack's weight (food): the shop's own pack field or net quantity, written with --fix-weights through
 *    worker_set_food_weights (a weight weighed at the hub or typed by an admin is never changed);
 *  - the shop's title (kept for every listing that has none, so a cut name can be made again) and, with --fix-names,
 *    a food name that was cut at the title's first "|".
 * Every option is a row of out/verify-<type>-<time>.csv, whatever was written.
 */

export interface VerifyOptions {
  dry: boolean;
  fixWeights: boolean;
  fixNames: boolean;
  /** The file every row goes to. */
  csv: string;
}

export interface VerifyTotals {
  listings: number;
  soldOut: number;
  stockChanges: number;
  weightsFixed: number;
  weightsToFix: number;
  toCheck: number;
  noPack: number;
  titles: number;
  names: number;
  namesToFix: number;
  blocked: number;
  failed: number;
}

export const emptyTotals = (): VerifyTotals => ({
  listings: 0,
  soldOut: 0,
  stockChanges: 0,
  weightsFixed: 0,
  weightsToFix: 0,
  toCheck: 0,
  noPack: 0,
  titles: 0,
  names: 0,
  namesToFix: 0,
  blocked: 0,
  failed: 0,
});

const HEAD = [
  'product_id', 'status', 'name', 'new_name', 'shop_title', 'site', 'item_url', 'option', 'stored_g',
  'stored_source', 'page_pack', 'page_g', 'read_from', 'weight', 'in_stock', 'note',
];
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function verifyCsv(type: string): string {
  const dir = join(ROOT, 'out');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `verify-${type}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.csv`);
  if (!existsSync(file)) writeFileSync(file, `${HEAD.join(',')}\n`);
  return file;
}

/** Where a pass got to, per type: the last listing id done, so the same command goes on after a stop. */
const PROGRESS = join(ROOT, 'out', 'verify-progress.json');
export function progressOf(type: string): string | null {
  try {
    return (JSON.parse(readFileSync(PROGRESS, 'utf8')) as Record<string, string>)[type] ?? null;
  } catch {
    return null;
  }
}
export function saveProgress(type: string, at: string | null): void {
  let all: Record<string, string> = {};
  try {
    all = JSON.parse(readFileSync(PROGRESS, 'utf8')) as Record<string, string>;
  } catch {
    // first pass
  }
  if (at) all[type] = at;
  else delete all[type];
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  writeFileSync(PROGRESS, JSON.stringify(all, null, 2));
}

interface Read {
  read: PageRead | null;
  error?: string;
  blocked?: boolean;
}

/** One listing: its pages read once each (an item a family page did not price, on its own page), then decided. */
async function verifyListing(ctx: RunContext, l: VerifyListing, opts: VerifyOptions, t: VerifyTotals) {
  const pages = new Map<string, Promise<Read>>();
  const readOnce = (site: string, url: string): Promise<Read> => {
    if (!pages.has(url)) pages.set(url, readPage(ctx, site, url));
    return pages.get(url)!;
  };
  const results: SourceResult[] = [];
  const reads = new Map<string, { read: PageRead | null; url: string }>();
  let blocked = false;
  for (const s of l.sources) {
    const first = await readOnce(s.site, s.page_url);
    if (first.blocked) blocked = true;
    let r = checkPage([s], first.read?.product ?? null, first.read?.pageDays ?? null, first.error).results[0]!;
    let used = { read: first.read, url: s.page_url };
    if (!r.ok && first.read?.product && s.item_url !== s.page_url) {
      const own = await readOnce(s.site, s.item_url);
      if (own.blocked) blocked = true;
      r = checkPage(
        [{ ...s, page_url: s.item_url }],
        own.read?.product ?? null,
        own.read?.pageDays ?? null,
        own.error,
      ).results[0]!;
      used = { read: own.read, url: s.item_url };
    }
    results.push(r);
    reads.set(s.id, used);
  }
  if (blocked) {
    // D-149: a robot check says nothing about the piece: nothing written, the listing waits for the next pass
    t.blocked += 1;
    appendFileSync(opts.csv, `${[l.product_id, l.status, l.name, '', l.shop_title, l.sources[0]?.site, l.sources[0]?.page_url, '', '', '', '', '', '', '', '', 'a shop showed a robot check: not checked'].map(cell).join(',')}\n`);
    return { weights: [] as FoodWrite[], title: null, name: null };
  }

  const firstRead = [...reads.values()].find((x) => x.read?.product)?.read?.product ?? null;
  const food = l.product_type === 'food';
  const title = firstRead?.title?.trim() || null;
  const newName = food ? nameFromTitle(l.name, title ?? l.shop_title, firstRead?.brand ?? null) : null;
  if (newName) t.namesToFix += 1;

  const weights: FoodWrite[] = [];
  const rows: string[] = [];
  for (const v of l.variants.filter((x) => x.is_active)) {
    const mine = l.sources.filter((s) => s.variant_id === v.id);
    const inStock = mine.some((s) => results.find((r) => r.id === s.id)?.in_stock === true);
    const unread = mine.filter((s) => !results.find((r) => r.id === s.id)?.ok);
    // the weight from the first source whose page states a pack (a family page's item, else its own page)
    let check = null as ReturnType<typeof checkWeight> | null;
    let pack = null as ReturnType<typeof pagePack>;
    let site = mine[0]?.site ?? '';
    let url = mine[0]?.item_url ?? '';
    for (const s of mine) {
      const used = reads.get(s.id);
      const product = used?.read?.product;
      if (!product) continue;
      const key = results.find((r) => r.id === s.id)?.item_key ?? s.item_key;
      const item = product.variants.length ? pageItems(product).find((i) => i.key === key) ?? null : null;
      const p = pagePack(product, item);
      if (!p) continue;
      pack = p;
      site = s.site;
      url = s.item_url;
      break;
    }
    if (food) {
      check = checkWeight(l.name, v, pack, site);
      if (check.verdict === 'fix') {
        t.weightsToFix += 1;
        weights.push(check.write!);
      } else if (check.verdict === 'check') t.toCheck += 1;
      else if (check.verdict === 'no pack') t.noPack += 1;
    }
    if (!inStock && mine.length && !unread.length) t.soldOut += 1;
    rows.push(
      [
        l.product_id, l.status, l.name, newName ?? '', title ?? l.shop_title ?? '', site, url, v.label, v.weight_g,
        v.weight_source, pack?.text ?? '', check?.grams ?? '', pack?.from ?? '', check?.verdict ?? '',
        mine.length ? (inStock ? 'yes' : 'no') : 'no source',
        unread.length ? `${unread.length} of ${mine.length} unread: ${results.find((r) => !r.ok)?.error ?? ''}` : '',
      ]
        .map(cell)
        .join(','),
    );
  }
  appendFileSync(opts.csv, rows.map((r) => `${r}\n`).join(''));

  if (!opts.dry) {
    const r = await ctx.db!.checked(l.product_id, { sources: results, added: [] });
    t.stockChanges += r.stock_changes;
  }
  t.listings += 1;
  return {
    weights,
    title: title && title !== l.shop_title ? { product_id: l.product_id, title } : null,
    name: newName ? { product_id: l.product_id, from: l.name, to: newName } : null,
  };
}

/** One page of the plan, side by side (each shop's lane keeps its own pace), then its writes in one go each. */
export async function verifyPage(
  ctx: RunContext,
  listings: VerifyListing[],
  opts: VerifyOptions,
  t: VerifyTotals,
): Promise<void> {
  const done = await Promise.all(
    listings.map((l) =>
      verifyListing(ctx, l, opts, t).catch((error) => {
        t.failed += 1;
        log(`  "${l.name}": not verified: ${errorText(error)}`);
        return { weights: [] as FoodWrite[], title: null, name: null };
      }),
    ),
  );
  if (opts.dry) return;
  const db = ctx.db!;
  const titles = done.flatMap((d) => (d.title ? [d.title] : []));
  if (titles.length) t.titles += await db.setShopTitles(titles);
  const weights = done.flatMap((d) => d.weights);
  // worker_set_food_weights takes 500 at most
  for (let i = 0; opts.fixWeights && i < weights.length; i += 500)
    t.weightsFixed += await db.setFoodWeights(weights.slice(i, i + 500));
  const names = done.flatMap((d) => (d.name ? [d.name] : []));
  if (opts.fixNames && names.length) t.names += await db.setFoodNames(names);
}

export const totalsText = (t: VerifyTotals, opts: VerifyOptions): string =>
  `${t.listings} listings verified: ${t.soldOut} options sold out at every shop (${t.stockChanges} stock changes ` +
  `written), weights ${opts.fixWeights ? `${t.weightsFixed} fixed` : `${t.weightsToFix} to fix (--fix-weights)`}, ` +
  `${t.toCheck} to check by eye (only the title's numbers), ${t.noPack} with no pack on the page; ${t.titles} shop ` +
  `titles kept; names ${opts.fixNames ? `${t.names} fixed` : `${t.namesToFix} to fix (--fix-names)`}; ` +
  `${t.blocked} behind a robot check, ${t.failed} failed`;

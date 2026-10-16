import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatGrams } from '@repo/shared/domain';
import { agreedWeight } from '@repo/shared/sourcing';
import { isSameItem, type WeightPlanListing } from '@repo/shared/sourcing/auto';
import { homeWeight, type HomeWeight } from '@repo/shared/sourcing/estimate';

import { ROOT } from './env';
import { readPage } from './find';
import { errorText, log } from './log';
import { shopFor } from './shops';

import type { RunContext } from './context';
import type { HomeWrite } from './db';
import type { SourcedProduct } from '@repo/shared/sourcing';

/**
 * D-134: home & gifts get the weight their own page states. For each listing worker_home_plan() names, every option
 * is read on its own page (on Amazon each size and colour is its own item with its own "Item details" and
 * "Measurements"), checked and packed (`homeWeight`); an option without its own page takes the listing page's weight
 * (marked similar); a listing no page weighs is looked up on Amazon and Flipkart, where two matching items must
 * agree. Never over the hub's scale or an admin's weight (the database refuses). `dry` writes nothing and keeps
 * every option in home-weights.csv.
 */

const SHEET = join(ROOT, 'home-weights.csv');
const WEIGHT_SHOPS = new Set(['amazon', 'flipkart']);
const PAGES_PER_RUN = 150;

interface Row {
  listing: string;
  option: string;
  before: string;
  w: HomeWeight;
  wrote: string;
}

const wanted = (v: WeightPlanListing['variants'][number], all: boolean): boolean =>
  v.weight_source !== 'weighed' &&
  v.weight_source !== 'admin' &&
  (all ||
    v.weight_g === null ||
    v.weight_source === null ||
    v.weight_source === 'similar' ||
    v.weight_source === 'estimated');

async function matching(
  ctx: RunContext,
  listing: WeightPlanListing,
): Promise<{ grams: number; note: string } | null> {
  const found: { site: string; grams: number }[] = [];
  for (const shop of ctx.plan.shops.filter(
    (s) => s.reader && WEIGHT_SHOPS.has(s.reader) && s.product_types.includes('home'),
  )) {
    try {
      const offers = (
        await shopFor(shop.reader).search(ctx.lanes.of(shop.site), listing.name)
      ).filter((o) => isSameItem(listing.name, o.title));
      for (const offer of offers.slice(0, 2)) {
        const read = await readPage(ctx, shop.site, offer.url);
        const w = read?.product ? homeWeight(read.product) : null;
        if (w?.grams && !w.look) found.push({ site: shop.site, grams: w.grams });
      }
    } catch (error) {
      log(`  ${shop.site}: home weight search failed: ${errorText(error)}`);
    }
  }
  const grams = found.length >= 2 ? agreedWeight(found.map((f) => f.grams)) : null;
  return grams
    ? {
        grams,
        note: `${found.length} matching items on ${[...new Set(found.map((f) => f.site))].join(', ')} (${found.map((f) => f.grams).join(', ')} g) (D-134)`,
      }
    : null;
}

export async function weighHome(
  ctx: RunContext,
  opts: { limit: number; dry: boolean; all?: boolean },
): Promise<number> {
  if (!ctx.db) return 0;
  const all = opts.all ?? false;
  const plan = await ctx.db.homePlan(opts.limit, all);
  if (!plan.length) return 0;
  log(`home weights: ${plan.length} listing${plan.length === 1 ? '' : 's'} to read`);
  const pages = new Map<string, SourcedProduct | null>();
  const rows: Row[] = [];
  const writes: HomeWrite[] = [];
  const read = async (site: string, url: string): Promise<SourcedProduct | null> => {
    if (!pages.has(url)) {
      if (pages.size >= PAGES_PER_RUN) return null;
      pages.set(url, (await readPage(ctx, site, url))?.product ?? null);
    }
    return pages.get(url) ?? null;
  };
  for (const listing of plan) {
    try {
      const site = (url: string): string =>
        listing.sources.find((s) => s.item_url === url || s.page_url === url)?.site ??
        listing.site ??
        new URL(url).hostname.replace(/^www\./, '');
      const main = listing.page_url ? await read(site(listing.page_url), listing.page_url) : null;
      const mainW = main ? homeWeight(main, { name: listing.name }) : null;
      const left: WeightPlanListing['variants'] = [];
      const mine: { v: WeightPlanListing['variants'][number]; write: HomeWrite; row: Row }[] = [];
      for (const v of listing.variants.filter((x) => wanted(x, all))) {
        const own = listing.sources.find((s) => s.variant_id === v.id);
        const page = own
          ? await read(own.site, own.item_url)
          : listing.variants.length === 1
            ? main
            : null;
        // no page of its own: its option's size as the shop sells it, if it states one
        const w = homeWeight(page ?? { title: '', specs: [] }, {
          name: listing.name,
          labels: [v.label, ...Object.values(v.options)],
        });
        const row: Row = {
          listing: listing.name,
          option: v.label,
          before: before(v),
          w,
          wrote: w.source ?? '',
        };
        if (w.grams && w.source) {
          const write: HomeWrite = {
            variant_id: v.id,
            weight_g: w.grams,
            source: w.source,
            note: w.note,
          };
          mine.push({ v, write, row });
        } else {
          left.push(v);
          if (page) rows.push(row);
        }
      }
      packsInOrder(mine);
      for (const m of mine) {
        writes.push(m.write);
        rows.push(m.row);
      }
      // what no own page weighs: the listing page's item (another option), else matching items elsewhere
      const fallback =
        left.length && mainW?.grams
          ? { grams: mainW.grams, note: `Another option's page: ${mainW.note}`.slice(0, 200) }
          : left.length &&
              !mine.length &&
              !listing.variants.some((v) => v.weight_g !== null && v.weight_source !== 'similar')
            ? await matching(ctx, listing)
            : null;
      for (const v of fallback ? left : []) {
        writes.push({
          variant_id: v.id,
          weight_g: fallback!.grams,
          source: 'similar',
          note: fallback!.note,
        });
        // the row of its unread page gives way to the weight it now has
        const at = rows.findIndex(
          (r) => r.listing === listing.name && r.option === v.label && !r.wrote,
        );
        if (at >= 0) rows.splice(at, 1);
        rows.push({
          listing: listing.name,
          option: v.label,
          before: before(v),
          w: {
            grams: fallback!.grams,
            source: null,
            note: fallback!.note,
            look: 'from another page: weigh it at the hub',
            sizeG: null,
          },
          wrote: 'similar',
        });
      }
    } catch (error) {
      log(`  "${listing.name.slice(0, 60)}": ${errorText(error)}`);
    }
  }
  let written = 0;
  for (let i = 0; !opts.dry && i < writes.length; i += 500)
    written += await ctx.db.setHomeWeights(writes.slice(i, i + 500));
  if (opts.dry) writeSheet(rows);
  const doubts = rows.filter((r) => r.w.look).length;
  log(
    `home weights: ${writes.length} options weighed from their pages (${pages.size} pages read), ${doubts} marked for the hub` +
      (opts.dry ? `; nothing written (--dry), sheet ${SHEET}` : `; ${written} written`),
  );
  return written;
}

const before = (v: WeightPlanListing['variants'][number]): string =>
  v.weight_g === null ? 'none' : `${formatGrams(v.weight_g)} ${v.weight_source ?? 'not recorded'}`;

const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

function writeSheet(rows: Row[]): void {
  const head = [
    'Listing',
    'Option',
    'Weight before',
    'New weight',
    'Source',
    'How',
    'By box size (Q-36)',
    'Look at it',
  ];
  const lines = rows.map((r) =>
    [
      r.listing,
      r.option,
      r.before,
      r.wrote && r.w.grams ? formatGrams(r.w.grams) : '(kept)',
      r.wrote,
      r.w.note,
      r.w.sizeG ? formatGrams(r.w.sizeG) : '',
      r.w.look ?? '',
    ]
      .map(cell)
      .join(','),
  );
  writeFileSync(SHEET, `﻿${[head.map(cell).join(','), ...lines].join('\r\n')}\r\n`, 'utf8');
}

/** "Pack of 5", "Set of 3", "Multicolor · 4", "12 pcs": how many pieces an option holds. */
function packCount(label: string): number | null {
  const m = label
    .toLowerCase()
    .match(/\b(?:pack|set) of (\d{1,3})\b|·\s*(\d{1,3})\s*$|\b(\d{1,3})\s*(?:pcs|pieces)\b/);
  const n = m ? Number(m[1] ?? m[2] ?? m[3]) : NaN;
  return n >= 1 ? n : null;
}

/**
 * The options of one listing that differ in how many pieces they hold must weigh in that order: a "Pack of 5" that
 * weighs no more than its "Pack of 1" is a seller's slip. Both are kept (each is its own page's) and marked.
 */
function packsInOrder(mine: { v: { label: string }; write: HomeWrite; row: Row }[]): void {
  for (const a of mine)
    for (const b of mine) {
      const na = packCount(a.v.label);
      const nb = packCount(b.v.label);
      if (na === null || nb === null || na <= nb || a.write.weight_g > b.write.weight_g) continue;
      const doubt = `check: ${na} pieces weigh no more than ${nb}`;
      a.row.w = { ...a.row.w, look: `${doubt}: weigh it at the hub` };
      if (!a.write.note.includes('check:'))
        a.write.note = `${a.write.note.replace(/ \(D-134\)$/, '')}; ${doubt} (D-134)`.slice(0, 200);
    }
}

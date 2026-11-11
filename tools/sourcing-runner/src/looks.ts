import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { lookKey, mediaPath, photoUrl, type PhotoPrint, type ProductType } from '@repo/shared/domain';
import {
  amazonFullSize,
  isConnectionDown,
  isOwnLook,
  amazonLookImages,
  itemKeyOf,
  LOOK_CSV_HEADER,
  lookAction,
  lookCsvRow,
  lookCsvUndo,
  missingLooks,
  type LookImages,
  type LookListing,
  type MissingLook,
  type StoredPrint,
} from '@repo/shared/sourcing/auto';

import { shopOf, type RunContext } from './context';
import { ROOT } from './env';
import { isBlocked, open } from './lanes';
import { errorText, log } from './log';
import { amazonLookData } from './pages';
import { photoPrint, PhotoStore } from './photo-store';
import { shopFor } from './shops';

import type { Db } from './db';

/**
 * `pnpm sourcing looks` (D-194, docs/plan-look-photos.md Phase 3): each look of a live listing gets its own photo.
 * Each listing's page is read once. A picture the listing already has only gets a tag; a new one goes up as two AVIF
 * copies, against `--photo-gb`. Every action goes to a CSV, which `--undo` reads back. A shop's robot check ends that
 * shop for the run (D-149, never tried again here), and a database timeout ends the run (D-146).
 */

const MAX_BYTES = 10 * 1024 * 1024;
/** Other pages read per listing, on top of its own, unless `--item-pages` says otherwise (at most 10). */
export const ITEM_PAGES_PER_LISTING = 4;
const PAUSE_MS = 2_500;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface LooksOptions {
  type: ProductType;
  limit: number;
  perLook: number;
  /** Item pages a listing may read for looks its own page doesn't show. */
  itemPages: number;
  dryRun: boolean;
  site: string | null;
  after: string | null;
  siteUrl: string;
}

export interface LooksTotals {
  listings: number;
  tagged: number;
  added: number;
  skipped: number;
  bytes: number;
  next: string | null;
  /** The plan had no listing left for this type. */
  ended: boolean;
  /** Why the run stopped early: the photo budget or a database timeout. */
  stopped: string | null;
  /** A shop's robot check: the run doesn't try that shop again. */
  blocked: boolean;
  /** The connection dropped: `next` is the last listing finished, to go on from once it is back. */
  offline: boolean;
}

class RunStop extends Error {}
class ConnectionDown extends Error {}
const stopIfTimeout = (error: unknown): void => {
  if (/statement timeout|57014|canceling statement/i.test(errorText(error))) {
    throw new RunStop(`the database timed out: stopping the run (${errorText(error).slice(0, 120)})`);
  }
};

/** A shop's picture, by its rules for a new listing's photos (photos.ts). */
async function fetchPicture(ctx: RunContext, url: string, referer: string): Promise<{ body: Buffer; type: string } | null> {
  try {
    const res = await ctx.lanes.browser.request.get(url, { timeout: 30_000, headers: { referer } });
    try {
      const type = res.headers()['content-type'] ?? '';
      if (!res.ok() || !/^image\/(jpeg|png|webp)/.test(type)) return null;
      const body = await res.body();
      return body.length < 2_000 || body.length > MAX_BYTES ? null : { body, type };
    } finally {
      await res.dispose();
    }
  } catch (error) {
    log(`  picture not read: ${errorText(error)}`);
    return null;
  }
}

/** The stored photos' prints, from their 640-pixel copies on the site (no Supabase read, no R2 write). */
async function storedPrints(listing: LookListing, siteUrl: string): Promise<StoredPrint[]> {
  const looks = new Map(listing.variants.map((v) => [v.id, v.options]));
  return Promise.all(
    listing.photos.map(async (p) => {
      let print: PhotoPrint | null = null;
      try {
        const res = await fetch(new URL(photoUrl(mediaPath('product-media', p.storage_path), 640), siteUrl));
        if (res.ok) print = await photoPrint(new Uint8Array(await res.arrayBuffer()));
      } catch (error) {
        log(`  stored photo not read: ${errorText(error)}`);
      }
      const tagged = p.variant_id && looks.has(p.variant_id) ? lookKey(looks.get(p.variant_id)!) : null;
      return { id: p.id, print, look: tagged };
    }),
  );
}

/** A look's picture on an item's own page: the first photo there. */
async function itemPagePhoto(ctx: RunContext, site: string, url: string): Promise<string | null> {
  const read = await shopFor(shopOf(ctx, site)?.reader ?? null).read(ctx.lanes.of(site), url, ctx.now);
  ctx.stats.page(site);
  return read.product?.images[0] ?? null;
}

/** Where each missing look's picture is, reading the listing's page once and a few item pages after it. */
async function findImages(ctx: RunContext, listing: LookListing, site: string, referer: string, itemPages: number) {
  const reader = shopOf(ctx, site)?.reader ?? null;
  const ownKey = itemKeyOf(listing.source_url);
  const missing = missingLooks(listing, ownKey);
  const images = new Map<string, LookImages>();
  if (reader === 'amazon') {
    const raw = await ctx.lanes.of(site).run(async (page) => {
      await open(page, referer, '#productTitle');
      return amazonLookData(page);
    });
    ctx.stats.page(site);
    for (const [look, found] of amazonLookImages(raw, missing)) images.set(look, found);
  } else {
    const read = await shopFor(reader).read(ctx.lanes.of(site), referer, ctx.now);
    ctx.stats.page(site);
    const items = new Map((read.product?.variants ?? []).map((v) => [v.key, v.image]));
    for (const m of missing) {
      const own = m.variants.some((v) => v.item_url === listing.source_url || v.item_key === ownKey);
      const item = m.variants.map((v) => (v.item_key ? items.get(v.item_key) : null)).find(Boolean);
      if (item) images.set(m.look, { urls: [item], method: 'item' });
      else if (own && read.product?.images[0]) images.set(m.look, { urls: [read.product.images[0]], method: 'page' });
    }
  }
  // Packs without pictures in the picker: an item's own page is the only place, a few per listing.
  let pages = 0;
  for (const m of missing) {
    if (images.has(m.look) || pages >= itemPages) continue;
    const url = m.variants.map((v) => v.item_url).find((u) => u && u !== listing.source_url && u !== referer);
    if (!url) continue;
    pages++;
    const photo = await itemPagePhoto(ctx, site, url);
    if (photo) images.set(m.look, { urls: [photo], method: 'item-page' });
  }
  return { missing, images };
}

async function workListing(
  ctx: RunContext,
  db: Db,
  listing: LookListing,
  site: string,
  opts: LooksOptions,
  row: (r: Parameters<typeof lookCsvRow>[0]) => void,
  totals: LooksTotals,
): Promise<void> {
  const referer = listing.source_url;
  const { missing, images } = await findImages(ctx, listing, site, referer, opts.itemPages);
  const stored = images.size > 0 ? await storedPrints(listing, opts.siteUrl) : [];
  const ownKey = itemKeyOf(listing.source_url);
  const mainId = listing.photos.find((p) => p.is_primary)?.id ?? null;
  const newPhotos: { path: string; variant_id: string; alt_text: string; look: MissingLook; bytes: number; method: string }[] = [];

  for (const m of missing) {
    const found = images.get(m.look);
    if (!found) {
      row({ listing: listing.id, look: m.look, action: 'no-image' });
      totals.skipped++;
      continue;
    }
    // the page's own look, found on its page or its own item: never a new photo (lookAction)
    const own = isOwnLook(m, found.method, listing.source_url, ownKey);
    for (const url of found.urls.slice(0, opts.perLook)) {
      // Amazon's picture at its own size first (dry runs 2026-11-09: most "too small" were 500-pixel previews)
      const full = amazonFullSize(url);
      const got = (await fetchPicture(ctx, full, referer)) ?? (full !== url ? await fetchPicture(ctx, url, referer) : null);
      const print = got ? await photoPrint(got.body) : null;
      if (!got || !print) {
        row({ listing: listing.id, look: m.look, action: 'no-image', method: found.method });
        totals.skipped++;
        continue;
      }
      const { action, photo } = lookAction(print, stored, own ? { mainId } : undefined);
      if (action === 'tag') {
        if (!opts.dryRun) await db.lookTag(listing.id, photo!, m.variants[0]!.id);
        const entry = stored.find((s) => s.id === photo);
        if (entry) entry.look = m.look;
        row({ listing: listing.id, look: m.look, action: opts.dryRun ? 'would-tag' : 'tagged', method: found.method, mediaId: photo! });
        totals.tagged++;
      } else if (action === 'add') {
        if (ctx.budget?.spent) throw new RunStop(`the photo budget is spent (${ctx.budget.text()})`);
        // later looks compare against this one too, so one picture for every pack is stored once
        stored.push({ id: `new-${m.look}`, print, look: m.look });
        if (opts.dryRun) {
          row({ listing: listing.id, look: m.look, action: 'would-add', method: found.method, bytes: got.body.length });
          totals.added++;
        } else {
          const before = PhotoStore.written;
          const path = await db.uploadStored(listing.id, got.body, got.type);
          const bytes = PhotoStore.written - before;
          ctx.budget?.add(bytes);
          totals.bytes += bytes;
          newPhotos.push({
            path,
            variant_id: m.variants[0]!.id,
            alt_text: `${listing.name}, ${m.label}`.slice(0, 200),
            look: m,
            bytes,
            method: found.method,
          });
        }
      } else {
        row({ listing: listing.id, look: m.look, action, method: found.method });
        totals.skipped++;
      }
    }
  }

  if (newPhotos.length > 0) {
    try {
      const ids = await db.lookAdd(listing.id, newPhotos.map(({ path, variant_id, alt_text }) => ({ path, variant_id, alt_text })));
      newPhotos.forEach((p, i) => {
        row({ listing: listing.id, look: p.look.look, action: 'added', method: p.method, mediaId: ids[i] ?? null, path: p.path, bytes: p.bytes });
        totals.added++;
      });
    } catch (error) {
      // not attached: no row shows them, so their copies go
      await Promise.all(newPhotos.map((p) => db.removeStored(p.path).catch(() => undefined)));
      throw error;
    }
  }
}

export async function runLooks(ctx: RunContext, db: Db, opts: LooksOptions): Promise<LooksTotals> {
  const totals: LooksTotals = {
    listings: 0,
    tagged: 0,
    added: 0,
    skipped: 0,
    bytes: 0,
    next: opts.after,
    ended: false,
    stopped: null,
    blocked: false,
    offline: false,
  };
  const dir = join(ROOT, 'out');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const file = join(dir, `looks-${opts.type}-${stamp}${opts.dryRun ? '-dry' : ''}.csv`);
  writeFileSync(file, `${LOOK_CSV_HEADER}\n`);
  const row = (r: Parameters<typeof lookCsvRow>[0]): void => appendFileSync(file, `${lookCsvRow(r)}\n`);
  const refused = new Set<string>();
  let after = opts.after;

  try {
    while (totals.listings < opts.limit) {
      let listings: LookListing[];
      try {
        ({ listings } = await db.lookPlan(opts.type, after, Math.min(25, opts.limit - totals.listings)));
      } catch (error) {
        if (isConnectionDown(errorText(error))) throw new ConnectionDown(errorText(error));
        throw error;
      }
      if (listings.length === 0) {
        totals.ended = true;
        break;
      }
      for (const listing of listings) {
        const before = after;
        after = listing.id;
        totals.next = listing.id;
        const site = listing.source_site ?? '';
        if ((opts.site && site !== opts.site) || !shopOf(ctx, site)) continue;
        if (refused.has(site)) {
          row({ listing: listing.id, look: '', action: 'blocked' });
          continue;
        }
        totals.listings++;
        try {
          await workListing(ctx, db, listing, site, opts, row, totals);
        } catch (error) {
          if (error instanceof RunStop) throw error;
          stopIfTimeout(error);
          if (isConnectionDown(errorText(error))) {
            // not this listing's fault: it is done again once the connection is back
            totals.next = before;
            throw new ConnectionDown(errorText(error));
          }
          if (isBlocked(error)) {
            // D-149: a refusal is the shop's answer for this run
            refused.add(site);
            totals.blocked = true;
            ctx.stats.page(site, error);
            log(`  ${site} refused the runner: no more of its listings this run`);
            row({ listing: listing.id, look: '', action: 'blocked' });
          } else {
            log(`  ${listing.id}: ${errorText(error)}`);
            row({ listing: listing.id, look: '', action: 'error' });
          }
        }
        await sleep(PAUSE_MS);
        if (totals.listings >= opts.limit) break;
      }
    }
  } catch (error) {
    if (error instanceof ConnectionDown) {
      totals.offline = true;
      log(`  the connection dropped: ${error.message.slice(0, 160)}`);
    } else if (error instanceof RunStop) {
      totals.stopped = error.message;
      log(`stopped: ${error.message}`);
    } else throw error;
  }
  log(`looks: wrote ${file}`);
  return totals;
}

/** `--undo <csv>`: the photos that run added are removed with their copies, its tags taken off. */
export async function undoLooks(db: Db, csvPath: string): Promise<{ removed: number; untagged: number }> {
  const { added, tagged } = lookCsvUndo(readFileSync(csvPath, 'utf8'));
  let removed = 0;
  for (let i = 0; i < added.length; i += 100) {
    const paths = await db.lookUndo(added.slice(i, i + 100));
    await Promise.all(paths.map((p) => db.removeStored(p)));
    removed += paths.length;
  }
  let untagged = 0;
  for (const t of tagged) {
    if (await db.lookTag(t.listing, t.media, null)) untagged++;
  }
  return { removed, untagged };
}

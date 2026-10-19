#!/usr/bin/env node
/**
 * scripts/photo-copies.mjs (D-140, the photo fix): fixed-size WebP copies for every photo stored before they were made
 * at upload time, so the store serves every photo straight from Supabase's CDN and never through a resizer (Vercel's
 * allowed 5,000 a month and then answered 402, 2026-10-18). For each listing photo, album photo and state main photo
 * without them it:
 *   1. writes `<name>.w320.webp`, `.w640.webp`, `.w1280.webp` into a `c/` folder beside it (WebP quality 80 with
 *      smartSubsample, never upscaled, a year's cache: the same as apps/web/lib/photo-copies.ts),
 *   2. copies the photo into that folder (a server-side copy, nothing uploaded twice),
 *   3. points its row at the new path.
 * The old file stays, because pages cached for up to a day may still name it. A day later, `--clean` removes the old
 * files whose photo has moved (it removes nothing a row still names).
 *
 * New photos get their copies when they are stored, and the admin panel catches up any it missed, a few at a time;
 * this script is for doing a large backlog at once, from a computer.
 *
 *   node scripts/photo-copies.mjs [--dry] [--limit=N] [--allow-remote]
 *   node scripts/photo-copies.mjs --clean [--dry] [--allow-remote]
 *
 * Reads apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Refuses a hosted project without
 * --allow-remote. Safe to stop and run again: it only takes photos still without copies.
 */
import { existsSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const clean = args.includes('--clean');
const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8) ?? Infinity);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
})();
if (!host || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local.');
  process.exit(2);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !args.includes('--allow-remote')) {
  console.error(`Refusing to change photos on ${host} without --allow-remote.`);
  process.exit(2);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp could not be loaded. Run pnpm install and try again.');
  process.exit(2);
}

const BUCKET = 'product-media';
const WIDTHS = [320, 640, 1280];
const WEBP = { quality: 80, smartSubsample: true };
const YEAR = '31536000';
const PAGE = 200;
const db = createClient(url, key, { auth: { persistSession: false } });

/** Where photos are recorded: table, id column, path column. */
const PLACES = [
  { table: 'product_media', path: 'storage_path' },
  { table: 'region_photos', path: 'storage_path' },
  { table: 'regions', path: 'hero_image_path' },
];

const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
/** `products/p1/abc.jpg` → `products/p1/c/abc.jpg`. */
const copyPath = (path) => path.replace(/\/([^/]+)$/, '/c/$1');
const sized = (path, w) => path.replace(IMAGE, `.w${w}.webp`);

/** One page of rows still without copies (after `after`, by id), or with them for --clean. */
async function page(place, after) {
  let q = db.from(place.table).select(`id, ${place.path}`).not(place.path, 'is', null).order('id').limit(PAGE);
  q = clean ? q.like(place.path, '%/c/%') : q.not(place.path, 'like', '%/c/%');
  if (after) q = q.gt('id', after);
  const { data, error } = await q;
  if (error) throw new Error(`${place.table}: ${error.message}`);
  return data.map((r) => ({ id: r.id, path: r[place.path] }));
}

/** The paths no row names. */
async function unnamed(paths) {
  const named = new Set();
  for (const place of PLACES) {
    // 40 at a time keeps the request's address short
    for (let i = 0; i < paths.length; i += 40) {
      const { data, error } = await db.from(place.table).select(place.path).in(place.path, paths.slice(i, i + 40));
      if (error) throw new Error(`${place.table}: ${error.message}`);
      for (const r of data) named.add(r[place.path]);
    }
  }
  return paths.filter((p) => !named.has(p));
}

async function copyOne(place, row) {
  const target = copyPath(row.path);
  if (dry) return;
  const { data: file, error: readError } = await db.storage.from(BUCKET).download(row.path);
  if (readError || !file) throw new Error(`read ${row.path}: ${readError?.message ?? 'missing'}`);
  const image = sharp(Buffer.from(await file.arrayBuffer()), { failOn: 'error' }).rotate();
  for (const w of WIDTHS) {
    const out = await image.clone().resize({ width: w, withoutEnlargement: true }).webp(WEBP).toBuffer();
    const { error } = await db.storage
      .from(BUCKET)
      .upload(sized(target, w), out, { contentType: 'image/webp', cacheControl: YEAR, upsert: true });
    if (error) throw new Error(`write ${sized(target, w)}: ${error.message}`);
  }
  const { error: copyError } = await db.storage.from(BUCKET).copy(row.path, target);
  if (copyError && !/exists/i.test(copyError.message)) throw new Error(`copy ${row.path}: ${copyError.message}`);
  const { error: rowError } = await db.from(place.table).update({ [place.path]: target }).eq('id', row.id).eq(place.path, row.path);
  if (rowError) throw new Error(`${place.table} ${row.id}: ${rowError.message}`);
}

let done = 0;
let failed = 0;
let removed = 0;
const started = Date.now();
for (const place of PLACES) {
  let after = null;
  for (;;) {
    if (done + failed >= limit) break;
    const rows = await page(place, after);
    if (!rows.length) break;
    after = rows[rows.length - 1].id;
    if (clean) {
      // the old file of a photo that moved into c/, unless some row still names it
      const old = await unnamed(rows.map((r) => r.path.replace(/\/c\/([^/]+)$/, '/$1')));
      if (!dry && old.length) {
        const { data, error } = await db.storage.from(BUCKET).remove(old);
        if (error) throw new Error(`clean: ${error.message}`);
        removed += data?.length ?? 0;
      }
      done += rows.length;
      continue;
    }
    const todo = rows.filter((r) => IMAGE.test(r.path)).slice(0, limit - done - failed);
    for (let i = 0; i < todo.length; i += 6) {
      const results = await Promise.allSettled(todo.slice(i, i + 6).map((r) => copyOne(place, r)));
      for (const r of results) {
        if (r.status === 'fulfilled') done += 1;
        else {
          failed += 1;
          console.error(`  failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        }
      }
      process.stdout.write(`\r${place.table}: ${done} done, ${failed} failed, ${Math.round((Date.now() - started) / 1000)} s`);
    }
  }
  process.stdout.write('\n');
}
if (clean) console.log(`${dry ? 'Would check' : 'Checked'} ${done} moved photo(s); removed ${removed} old file(s).`);
else console.log(`${dry ? 'Would do' : 'Done'}: ${done}; failed: ${failed}.${failed ? ' Run again to retry the failed ones.' : ''}`);
process.exitCode = failed ? 1 : 0;

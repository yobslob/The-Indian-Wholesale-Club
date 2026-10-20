#!/usr/bin/env node
/**
 * scripts/photo-move.mjs (D-140, the photo fix, 2026-10-20): moves photos from Supabase's storage (1 GB on its free
 * plan; production held 7.9 GB) into the photo store (Cloudflare R2), as the website does for new ones: two AVIF
 * copies, 640 and 1200 px (packages/shared media.ts, the same settings as apps/web/lib/photo-copies.ts), the row
 * pointed at its `s/` path, and the Supabase file removed 10 minutes later (store pages are cached for 5).
 * Most needed first: live listings' main photos, then the rest of each live listing, drafts, archived, album, state and
 * review photos. Every download counts as Supabase egress (5 GB a month on the free plan), so a run stops at --max-gb
 * and the next run carries on.
 * A listing's photos are moved together, and a photo it has twice (Amazon's full-size photo and its 500-pixel preview,
 * D-142, a third of the listing photos) is kept once: the full-size file, in the first one's place. Photos already in
 * the store are compared through their 1200 copy, read from the store (no Supabase egress).
 *
 *   pnpm photos:move -- --env=<file> [--dry] [--max-gb=2.5] [--allow-remote]
 *   pnpm photos:move -- --env=<file> --review=20 [--allow-remote]
 *   pnpm photos:move -- --env=<file> --clean [--dry] [--allow-remote]
 *
 * --env: a file with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PHOTO_STORE_S3_URL, PHOTO_STORE_KEY_ID,
 * PHOTO_STORE_SECRET, PHOTO_STORE_PUBLIC_URL (default apps/web/.env.local, usually the local database). --review reads
 * that many live listings and puts each photo it would drop beside the one it keeps in .checks/photo-repeats/, changing
 * nothing. --clean downloads nothing: it removes Supabase files no row names (moved photos' old files, abandoned
 * uploads, old WebP copies) older than a day.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const envFile = flag('env') ?? 'apps/web/.env.local';
if (!existsSync(envFile)) throw new Error(`No ${envFile}`);
process.loadEnvFile(envFile);
const dry = args.includes('--dry');
const clean = args.includes('--clean');
const review = Number(flag('review') ?? 0);
const maxBytes = Number(flag('max-gb') ?? 2.5) * 1e9;

const env = (name) => process.env[name] ?? '';
const url = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const host = URL.canParse(url) ? new URL(url).hostname : '';
const local = ['127.0.0.1', 'localhost'].includes(host);
if (!host || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new Error(`${envFile}: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
const STORE_VARS = ['PHOTO_STORE_S3_URL', 'PHOTO_STORE_KEY_ID', 'PHOTO_STORE_SECRET', 'PHOTO_STORE_PUBLIC_URL'];
if (!clean && !STORE_VARS.every(env)) throw new Error(`${envFile}: set ${STORE_VARS.join(', ')} (docs/ops.md §Photos)`);
console.log(`Database: ${host} (${local ? 'local' : 'HOSTED'})${clean ? '' : `\nPhoto store: ${env('PHOTO_STORE_S3_URL')}`}`);
if (!local && !args.includes('--allow-remote')) {
  console.error('A hosted database: add --allow-remote to go ahead.');
  process.exit(2);
}

const db = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const s3 = clean ? null : new AwsClient({ accessKeyId: env('PHOTO_STORE_KEY_ID'), secretAccessKey: env('PHOTO_STORE_SECRET'), service: 's3', region: env('PHOTO_STORE_REGION') || 'auto' });
const STORE = env('PHOTO_STORE_S3_URL').replace(/\/+$/, '');
const PUBLIC = env('PHOTO_STORE_PUBLIC_URL').replace(/\/+$/, '');
const WIDTHS = [640, 1200];
const AVIF = { 640: { quality: 60, effort: 2 }, 1200: { quality: 55, effort: 2 } };
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const STORED = /\/s\/[^/]+$/;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const storedPath = (p) => p.replace(/\/c\/([^/]+)$/, '/$1').replace(/\/([^/]+)$/, '/s/$1');
const storeKeys = (bucket, p) => WIDTHS.map((w) => `${bucket}/${p.replace(IMAGE, `.w${w}.avif`)}`);
/** A not-yet-stored photo's Supabase files: the photo, and the WebP copies of 2026-10-19 beside a c/ photo. */
const supabaseFiles = (p) => (/\/c\/[^/]+$/.test(p) ? [p, ...[320, 640, 1280].map((w) => p.replace(IMAGE, `.w${w}.webp`))] : [p]);

/** The passes, most needed first: [label, bucket, table, path column, query narrowing]; `products`: listings whole. */
const PASSES = [
  ['live listings, main photos', 'product-media', 'product_media', 'storage_path', (q) => q.eq('products.status', 'live').eq('is_primary', true)],
  ['live listings', 'product-media', 'products', 'storage_path', (q) => q.eq('status', 'live')],
  ['draft and archived listings', 'product-media', 'products', 'storage_path', (q) => q.neq('status', 'live')],
  ['album photos', 'product-media', 'region_photos', 'storage_path', (q) => q],
  ['state main photos', 'product-media', 'regions', 'hero_image_path', (q) => q.not('hero_image_path', 'is', null)],
  ['review photos', 'review-media', 'review_photos', 'storage_path', (q) => q],
];

async function page(table, col, narrow, after) {
  if (table === 'products') return listingPage(narrow, after);
  const select = table === 'product_media' ? `id, ${col}, products!inner(status)` : `id, ${col}`;
  let q = narrow(db.from(table).select(select)).not(col, 'like', '%/s/%').order('id').limit(200);
  if (after) q = q.gt('id', after);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.map((r) => ({ id: r.id, path: r[col] })).filter((r) => IMAGE.test(r.path));
}

let downloaded = 0;
let moved = 0;
let repeats = 0;
let failed = 0;
const pending = []; // [time, bucket or 'store', files]: removed 10 minutes after their row changed

async function removeDue(all = false) {
  const due = pending.filter(([t]) => all || Date.now() - t > 10 * 60_000);
  for (const bucket of ['product-media', 'review-media']) {
    const files = due.filter(([, b]) => b === bucket).flatMap(([, , f]) => f);
    for (let i = 0; i < files.length; i += 100) await db.storage.from(bucket).remove(files.slice(i, i + 100));
  }
  for (const key of due.filter(([, b]) => b === 'store').flatMap(([, , f]) => f)) await s3.fetch(`${STORE}/${enc(key)}`, { method: 'DELETE' });
  pending.splice(0, pending.length, ...pending.filter((p) => !due.includes(p)));
}

/** Fetches a file, 8 at a time and with three tries: Supabase drops a busy connection now and then. */
let active = 0;
const queue = [];
async function get(address) {
  if (active >= 8) await new Promise((r) => queue.push(r));
  active += 1;
  try {
    for (let i = 0; ; i++) {
      try {
        const res = await fetch(address);
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
        await res.body?.cancel();
        if (i >= 2 || (res.status < 500 && res.status !== 429)) throw Object.assign(new Error(`${res.status}`), { final: true });
      } catch (error) {
        if (error.final || i >= 2) throw error;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

async function download(bucket, path) {
  try {
    const bytes = await get(`${url}/storage/v1/object/public/${bucket}/${enc(path)}`);
    downloaded += bytes.length;
    return bytes;
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}

async function moveOne(bucket, table, col, row, given = null) {
  const bytes = given ?? (await download(bucket, row.path));
  const target = storedPath(row.path);
  const image = sharp(bytes, { failOn: 'error' }).rotate();
  await Promise.all(
    WIDTHS.map(async (w) => {
      const body = await image.clone().resize({ width: w, withoutEnlargement: true }).avif(AVIF[w]).toBuffer();
      const put = await s3.fetch(`${STORE}/${enc(`${bucket}/${target.replace(IMAGE, `.w${w}.avif`)}`)}`, {
        method: 'PUT',
        body: new Uint8Array(body),
        headers: { 'content-type': 'image/avif', 'cache-control': 'public, max-age=31536000, immutable' },
      });
      if (!put.ok) throw new Error(`photo store ${put.status}: ${(await put.text()).slice(0, 120)}`);
    }),
  );
  const { error } = await db.from(table).update({ [col]: target }).eq('id', row.id).eq(col, row.path);
  if (error) throw new Error(`${table} ${row.id}: ${error.message}`);
  pending.push([Date.now(), bucket, supabaseFiles(row.path)]);
  moved += 1;
}

// ---------------------------------------------------------------- listings whole, repeats dropped (D-142)

/** Listings with a photo not yet in the store, 25 at a time in id order, each with all its photos in order. */
async function listingPage(narrow, after) {
  let q = narrow(db.from('products').select('id, product_media!inner(id)')).not('product_media.storage_path', 'like', '%/s/%').order('id').limit(25);
  if (after) q = q.gt('id', after);
  const { data, error } = await q;
  if (error) throw new Error(`products: ${error.message}`);
  if (!data.length) return [];
  const { data: media, error: mediaError } = await db
    .from('product_media')
    .select('id, product_id, storage_path, variant_id')
    .in('product_id', data.map((p) => p.id))
    .order('is_primary', { ascending: false })
    .order('sort_order')
    .order('created_at');
  if (mediaError) throw new Error(`product_media: ${mediaError.message}`);
  return data.map((p) => ({ id: p.id, photos: media.filter((m) => m.product_id === p.id) }));
}

/**
 * A photo's print, as packages/shared same-picture.ts (D-142): 256 × 256 and softened, the same picture when the shape
 * matches and PSNR ≥ 27 dB. Its size counts as stored (never wider than the 1200 copy; the shape is kept), so a photo
 * already in the store isn't swapped for an equal one.
 */
async function print(bytes) {
  try {
    const image = sharp(bytes, { failOn: 'error' });
    const { width, height, orientation } = await image.metadata();
    const [w, h] = (orientation ?? 1) >= 5 ? [height, width] : [width, height];
    const pixels = await image.rotate().flatten({ background: '#fff' }).resize(256, 256, { fit: 'fill' }).blur(1.5).removeAlpha().raw().toBuffer();
    const k = Math.min(1, 1200 / w);
    return { width: w * k, height: h * k, pixels };
  } catch {
    return null;
  }
}

function samePicture(a, b) {
  if (!a || !b || Math.abs(a.width / a.height - b.width / b.height) > 0.02) return false;
  let squares = 0;
  for (let i = 0; i < a.pixels.length; i++) squares += (a.pixels[i] - b.pixels[i]) ** 2;
  const mse = squares / a.pixels.length;
  return mse === 0 || 10 * Math.log10(65025 / mse) >= 27;
}

/** A listing's photos in groups of one picture (never across variants): the first one's place, the photo to keep. */
function groupsOf(items) {
  const groups = [];
  for (const it of items) {
    const group = groups.find((g) => g[0].row.variant_id === it.row.variant_id && samePicture(g[0].print, it.print));
    if (group) group.push(it);
    else groups.push([it]);
  }
  const pixels = (it) => (it.print ? it.print.width * it.print.height : 0);
  return groups.map((all) => ({ all, place: all[0], best: all.reduce((b, it) => (pixels(it) > pixels(b) ? it : b)) }));
}

let sheets = 0;
let reviewed = 0;
async function sheet(keep, drop) {
  const tile = (it) => sharp(it.bytes).resize(300, 300, { fit: 'contain', background: '#fff' }).toBuffer();
  mkdirSync('.checks/photo-repeats', { recursive: true });
  await sharp({ create: { width: 600, height: 300, channels: 3, background: '#fff' } })
    .composite([{ input: await tile(keep), left: 0, top: 0 }, { input: await tile(drop), left: 300, top: 0 }])
    .png()
    .toFile(`.checks/photo-repeats/${String(++sheets).padStart(3, '0')}-${keep.row.product_id.slice(0, 8)}.png`);
}

async function moveListing(listing) {
  const items = await Promise.all(
    listing.photos.map(async (row) => {
      let bytes = null;
      if (STORED.test(row.storage_path)) {
        bytes = await get(`${PUBLIC}/${enc(storeKeys('product-media', row.storage_path)[1])}`).catch(() => null);
      } else if (IMAGE.test(row.storage_path)) {
        bytes = await download('product-media', row.storage_path).catch((e) => ((failed += 1), console.error(`\n  failed: ${e.message}`), null));
      }
      return { row, bytes, print: bytes ? await print(bytes) : null };
    }),
  );
  for (const { all, place, best } of groupsOf(items)) {
    const drop = all.filter((it) => it !== best);
    if (review) {
      for (const it of drop) await sheet(best, it);
      repeats += drop.length;
      continue;
    }
    const keepPath = best.row.storage_path;
    if (best !== place) {
      // the full-size file takes the first one's place: its order, main-photo mark and words
      const { error } = await db.from('product_media').update({ storage_path: keepPath }).eq('id', place.row.id).eq('storage_path', place.row.storage_path);
      if (error) throw new Error(`product_media ${place.row.id}: ${error.message}`);
    }
    const gone = all.filter((it) => it !== place);
    if (gone.length) {
      const { error } = await db.from('product_media').delete().in('id', gone.map((it) => it.row.id));
      if (error) throw new Error(`product_media: ${error.message}`);
      repeats += gone.length;
    }
    // the dropped files go with the moved photos' files, once cached pages no longer name them
    const files = all.map((it) => it.row.storage_path).filter((p) => p !== keepPath);
    const inStore = files.filter((p) => STORED.test(p));
    if (files.length > inStore.length) pending.push([Date.now(), 'product-media', files.filter((p) => !STORED.test(p)).flatMap(supabaseFiles)]);
    if (inStore.length) pending.push([Date.now(), 'store', inStore.flatMap((p) => storeKeys('product-media', p))]);
    if (!STORED.test(keepPath) && best.bytes) {
      await moveOne('product-media', 'product_media', 'storage_path', { id: place.row.id, path: keepPath }, best.bytes);
    }
  }
}

async function move() {
  const workers = Math.max(2, Math.floor(availableParallelism() * 0.75));
  sharp.concurrency(1);
  for (const [label, bucket, table, col, narrow] of PASSES) {
    const listings = table === 'products';
    if (review && !listings) continue;
    const step = listings ? Math.max(2, Math.floor(workers / 2)) : workers;
    let after = null;
    let total = 0;
    for (;;) {
      if (downloaded >= maxBytes) return console.log(`\nStopped at the ${maxBytes / 1e9} GB download budget; run again to carry on.`);
      const rows = await page(table, col, narrow, after);
      if (!rows.length) break;
      after = rows[rows.length - 1].id;
      total += rows.length;
      if (dry) continue;
      for (let i = 0; i < rows.length; i += step) {
        const batch = rows.slice(i, i + (review ? Math.min(step, review - reviewed) : step));
        reviewed += batch.length;
        const results = await Promise.allSettled(batch.map((r) => (listings ? moveListing(r) : moveOne(bucket, table, col, r))));
        for (const r of results) if (r.status === 'rejected') (failed += 1), console.error(`\n  failed: ${r.reason?.message ?? r.reason}`);
        process.stdout.write(`\r${label}: ${moved} moved, ${repeats} repeats ${review ? 'found' : 'dropped'}, ${failed} failed, ${(downloaded / 1e9).toFixed(2)} GB downloaded`);
        if (review && reviewed >= review) return console.log(`\n${repeats} repeats in ${review} listings, each beside the photo kept: .checks/photo-repeats/`);
        await removeDue();
        if (downloaded >= maxBytes) break;
      }
    }
    console.log(`\n${label}: ${dry ? `${total} ${listings ? 'listings' : 'photos'} to move` : 'done'}`);
  }
}

/** Every Supabase file under a folder, recursively. */
async function walk(bucket, prefix, out) {
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    for (const f of data) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (f.id === null) await walk(bucket, path, out);
      else out.push({ path, size: f.metadata?.size ?? 0, at: Date.parse(f.created_at) });
    }
    if (data.length < 1000) return;
  }
}

async function named(bucket) {
  const names = new Set();
  const sources = bucket === 'product-media'
    ? [['product_media', 'storage_path'], ['region_photos', 'storage_path'], ['regions', 'hero_image_path']]
    : [['review_photos', 'storage_path']];
  for (const [table, col] of sources) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select(col).order(col).range(from, from + 999);
      if (error) throw new Error(`${table}: ${error.message}`);
      for (const r of data) if (r[col]) names.add(r[col]);
      if (data.length < 1000) break;
    }
  }
  return names;
}

async function cleanUp() {
  for (const [bucket, folders] of [['product-media', ['products', 'regions']], ['review-media', ['']]]) {
    const keep = await named(bucket);
    const files = [];
    for (const f of folders) await walk(bucket, f, files);
    const gone = files.filter((f) => !keep.has(f.path) && !STORED.test(f.path) && Date.now() - f.at > 86_400_000);
    const mb = Math.round(gone.reduce((n, f) => n + f.size, 0) / 1e6);
    console.log(`${bucket}: ${files.length} files, ${gone.length} that no row names (${mb} MB)${dry ? ' would go' : ' removed'}`);
    if (!dry) for (let i = 0; i < gone.length; i += 100) await db.storage.from(bucket).remove(gone.slice(i, i + 100).map((f) => f.path));
  }
}

if (clean) await cleanUp();
else {
  await move();
  if (pending.length && !dry && !review) {
    // a local database has no cached pages to wait for
    const wait = local ? 0 : Math.max(0, 10 * 60_000 - (Date.now() - pending[pending.length - 1][0]));
    console.log(`Removing the moved and dropped photos' old files in ${Math.ceil(wait / 60_000)} min (store pages cached until then still name them)…`);
    await new Promise((r) => setTimeout(r, wait));
    await removeDue(true);
  }
  console.log(`${dry || review ? 'Nothing changed' : 'Done'}: ${moved} moved, ${repeats} repeats ${review ? 'found' : 'dropped'}, ${failed} failed, ${(downloaded / 1e9).toFixed(2)} GB downloaded.`);
  process.exitCode = failed ? 1 : 0;
}

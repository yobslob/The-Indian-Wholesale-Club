#!/usr/bin/env node
/**
 * scripts/photo-move.mjs (D-140, the photo fix, 2026-10-20): moves photos from Supabase's storage (1 GB on its free
 * plan; production held 7.9 GB) into the photo store (Cloudflare R2), as the website does for new ones: two AVIF
 * copies, 640 and 1200 px (packages/shared media.ts, the same settings as apps/web/lib/photo-copies.ts), the row
 * pointed at its `s/` path, and the Supabase file removed 10 minutes later (store pages are cached for 5).
 * Most needed first: live listings' main photos, their other photos, then drafts, archived, album, state and review
 * photos. Every download counts as Supabase egress (5 GB a month on the free plan), so a run stops at --max-gb and the
 * next run carries on.
 *
 *   pnpm photos:move -- --env=<file> [--dry] [--max-gb=2.5] [--allow-remote]
 *   pnpm photos:move -- --env=<file> --clean [--dry] [--allow-remote]
 *
 * --env: a file with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and PHOTO_STORE_S3_URL, PHOTO_STORE_KEY_ID,
 * PHOTO_STORE_SECRET (default apps/web/.env.local, usually the local database). --clean downloads nothing: it removes
 * Supabase files no row names (moved photos' old files, abandoned uploads, old WebP copies) older than a day.
 */
import { existsSync } from 'node:fs';
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
const maxBytes = Number(flag('max-gb') ?? 2.5) * 1e9;

const env = (name) => process.env[name] ?? '';
const url = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
const host = URL.canParse(url) ? new URL(url).hostname : '';
const local = ['127.0.0.1', 'localhost'].includes(host);
if (!host || !env('SUPABASE_SERVICE_ROLE_KEY')) throw new Error(`${envFile}: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
if (!clean && !(env('PHOTO_STORE_S3_URL') && env('PHOTO_STORE_KEY_ID') && env('PHOTO_STORE_SECRET'))) {
  throw new Error(`${envFile}: set PHOTO_STORE_S3_URL, PHOTO_STORE_KEY_ID and PHOTO_STORE_SECRET (docs/ops.md §Photos)`);
}
console.log(`Database: ${host} (${local ? 'local' : 'HOSTED'})${clean ? '' : `\nPhoto store: ${env('PHOTO_STORE_S3_URL')}`}`);
if (!local && !args.includes('--allow-remote')) {
  console.error('A hosted database: add --allow-remote to go ahead.');
  process.exit(2);
}

const db = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const s3 = clean ? null : new AwsClient({ accessKeyId: env('PHOTO_STORE_KEY_ID'), secretAccessKey: env('PHOTO_STORE_SECRET'), service: 's3', region: env('PHOTO_STORE_REGION') || 'auto' });
const STORE = env('PHOTO_STORE_S3_URL').replace(/\/+$/, '');
const WIDTHS = [640, 1200];
const AVIF = { 640: { quality: 60, effort: 2 }, 1200: { quality: 55, effort: 2 } };
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;
const STORED = /\/s\/[^/]+$/;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const storedPath = (p) => p.replace(/\/c\/([^/]+)$/, '/$1').replace(/\/([^/]+)$/, '/s/$1');
/** A not-yet-stored photo's Supabase files: the photo, and the WebP copies of 2026-10-19 beside a c/ photo. */
const supabaseFiles = (p) => (/\/c\/[^/]+$/.test(p) ? [p, ...[320, 640, 1280].map((w) => p.replace(IMAGE, `.w${w}.webp`))] : [p]);

/** The passes, most needed first: [label, bucket, table, path column, query narrowing]. */
const PASSES = [
  ['live listings, main photos', 'product-media', 'product_media', 'storage_path', (q) => q.eq('products.status', 'live').eq('is_primary', true)],
  ['live listings, other photos', 'product-media', 'product_media', 'storage_path', (q) => q.eq('products.status', 'live').eq('is_primary', false)],
  ['draft and archived listings', 'product-media', 'product_media', 'storage_path', (q) => q.neq('products.status', 'live')],
  ['album photos', 'product-media', 'region_photos', 'storage_path', (q) => q],
  ['state main photos', 'product-media', 'regions', 'hero_image_path', (q) => q.not('hero_image_path', 'is', null)],
  ['review photos', 'review-media', 'review_photos', 'storage_path', (q) => q],
];

async function page(table, col, narrow, after) {
  const select = table === 'product_media' ? `id, ${col}, products!inner(status)` : `id, ${col}`;
  let q = narrow(db.from(table).select(select)).not(col, 'like', '%/s/%').order('id').limit(200);
  if (after) q = q.gt('id', after);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.map((r) => ({ id: r.id, path: r[col] }));
}

let downloaded = 0;
let moved = 0;
let failed = 0;
const pending = []; // [time, bucket, files]: Supabase files to remove 10 minutes after their photo moved

async function removeDue(all = false) {
  const due = pending.filter(([t]) => all || Date.now() - t > 10 * 60_000);
  for (const bucket of ['product-media', 'review-media']) {
    const files = due.filter(([, b]) => b === bucket).flatMap(([, , f]) => f);
    for (let i = 0; i < files.length; i += 100) await db.storage.from(bucket).remove(files.slice(i, i + 100));
  }
  pending.splice(0, pending.length, ...pending.filter((p) => !due.includes(p)));
}

async function moveOne(bucket, table, col, row) {
  const res = await fetch(`${url}/storage/v1/object/public/${bucket}/${enc(row.path)}`);
  if (!res.ok) throw new Error(`${row.path}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  downloaded += bytes.length;
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
}

async function move() {
  const workers = Math.max(2, Math.floor(availableParallelism() * 0.75));
  sharp.concurrency(1);
  for (const [label, bucket, table, col, narrow] of PASSES) {
    let after = null;
    let total = 0;
    for (;;) {
      if (downloaded >= maxBytes) return console.log(`\nStopped at the ${maxBytes / 1e9} GB download budget; run again to carry on.`);
      const rows = (await page(table, col, narrow, after)).filter((r) => IMAGE.test(r.path));
      if (!rows.length) break;
      after = rows[rows.length - 1].id;
      total += rows.length;
      if (dry) continue;
      for (let i = 0; i < rows.length; i += workers) {
        const results = await Promise.allSettled(rows.slice(i, i + workers).map((r) => moveOne(bucket, table, col, r)));
        for (const r of results) {
          if (r.status === 'fulfilled') moved += 1;
          else (failed += 1), console.error(`\n  failed: ${r.reason?.message ?? r.reason}`);
        }
        process.stdout.write(`\r${label}: ${moved} moved, ${failed} failed, ${(downloaded / 1e9).toFixed(2)} GB downloaded`);
        await removeDue();
        if (downloaded >= maxBytes) break;
      }
    }
    console.log(`\n${label}: ${dry ? `${total} to move` : 'done'}`);
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
  if (pending.length && !dry) {
    // a local database has no cached pages to wait for
    const wait = local ? 0 : Math.max(0, 10 * 60_000 - (Date.now() - pending[pending.length - 1][0]));
    console.log(`Removing the moved photos' Supabase files in ${Math.ceil(wait / 60_000)} min (store pages cached until then still name them)…`);
    await new Promise((r) => setTimeout(r, wait));
    await removeDue(true);
  }
  console.log(`${dry ? 'Dry run' : 'Done'}: ${moved} moved, ${failed} failed, ${(downloaded / 1e9).toFixed(2)} GB downloaded.`);
  process.exitCode = failed ? 1 : 0;
}

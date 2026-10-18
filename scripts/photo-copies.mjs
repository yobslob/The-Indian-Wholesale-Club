#!/usr/bin/env node
/**
 * scripts/photo-copies.mjs (D-140, the photo fix): fixed-size WebP copies of every product and album photo, so the
 * store serves photos straight from Supabase's CDN instead of Vercel's resizer (whose allowance ran out: 402,
 * 2026-10-18). For each photo not done yet it:
 *   1. copies the original to a `c/` folder beside it (a server-side copy, nothing downloaded twice),
 *   2. writes `<name>.w320.webp`, `.w640.webp`, `.w1280.webp` there (quality 75, never upscaled, a year's cache),
 *   3. points the photo's row at the new path (product_media, region_photos).
 * The store's image loader (apps/web/lib/image-loader.ts) serves any photo in a `c/` folder from its copies; the rest
 * keep going through Next's resizer, so the store works before, during and after a run. Old originals stay where they
 * were (cached pages may still name them for a few minutes).
 *
 *   node scripts/photo-copies.mjs [--dry] [--limit=200] [--allow-remote]
 *
 * Reads apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Refuses a hosted project without
 * --allow-remote. Needs sharp (installed with Next; `pnpm add -D -w sharp` makes it explicit).
 */
import { existsSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const limit = Number(args.find((a) => a.startsWith('--limit='))?.slice(8) ?? 200);
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
  console.error('sharp is not installed. Run: pnpm add -D -w sharp');
  process.exit(2);
}

const BUCKET = 'product-media';
const WIDTHS = [320, 640, 1280];
const YEAR = '31536000';
const db = createClient(url, key, { auth: { persistSession: false } });

/** `products/p1/abc.jpg` → `products/p1/c/abc.jpg` (a path already in a c/ folder stays). */
const copyPath = (path) => (/\/c\/[^/]+$/.test(path) ? path : path.replace(/\/([^/]+)$/, '/c/$1'));
const sized = (path, w) => path.replace(/\.(jpe?g|png|webp|avif)$/i, `.w${w}.webp`);

async function todo(table) {
  const { data, error } = await db
    .from(table)
    .select('id, storage_path')
    .not('storage_path', 'like', '%/c/%')
    .order('id')
    .limit(limit);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.filter((r) => /\.(jpe?g|png|webp|avif)$/i.test(r.storage_path));
}

async function one(table, row) {
  const target = copyPath(row.storage_path);
  if (dry) return `${row.storage_path} → ${target} + ${WIDTHS.map((w) => sized(target, w).split('/').pop()).join(', ')}`;
  const { data: file, error: readError } = await db.storage.from(BUCKET).download(row.storage_path);
  if (readError || !file) throw new Error(`read ${row.storage_path}: ${readError?.message ?? 'missing'}`);
  const input = Buffer.from(await file.arrayBuffer());
  for (const w of WIDTHS) {
    const out = await sharp(input).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    const { error } = await db.storage
      .from(BUCKET)
      .upload(sized(target, w), out, { contentType: 'image/webp', cacheControl: YEAR, upsert: true });
    if (error) throw new Error(`write ${sized(target, w)}: ${error.message}`);
  }
  const { error: copyError } = await db.storage.from(BUCKET).copy(row.storage_path, target);
  if (copyError && !/exists/i.test(copyError.message)) throw new Error(`copy ${row.storage_path}: ${copyError.message}`);
  const { error: rowError } = await db.from(table).update({ storage_path: target }).eq('id', row.id);
  if (rowError) throw new Error(`${table} ${row.id}: ${rowError.message}`);
  return `${row.storage_path} → ${target}`;
}

let done = 0;
let failed = 0;
for (const table of ['product_media', 'region_photos']) {
  const rows = await todo(table);
  console.log(`${table}: ${rows.length} photo(s) to do${dry ? ' (dry run)' : ''}`);
  for (let i = 0; i < rows.length; i += 4) {
    const results = await Promise.allSettled(rows.slice(i, i + 4).map((r) => one(table, r)));
    for (const r of results) {
      if (r.status === 'fulfilled') {
        done += 1;
        if (dry) console.log(`  ${r.value}`);
      } else {
        failed += 1;
        console.error(`  failed: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
      }
    }
  }
}
console.log(`${dry ? 'Would do' : 'Done'}: ${done}; failed: ${failed}.${dry ? '' : ' Run again until nothing is left (each run takes up to --limit per table).'}`);
process.exitCode = failed ? 1 : 0;

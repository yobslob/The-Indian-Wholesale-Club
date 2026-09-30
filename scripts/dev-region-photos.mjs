#!/usr/bin/env node
/**
 * scripts/dev-region-photos.mjs: puts the founder's region photos (design/mockups/assets, D-056) into the
 * LOCAL database and storage, the same way the admin Regions page does (product-media/regions/<slug>/).
 *
 *   pnpm dev:region-photos
 *
 * `check.mjs db` resets the local database, which forgets uploaded photos; run this again afterwards.
 * On the hosted dev database, upload them through the admin Regions page instead.
 * Reads apps/web/.env.local; refuses anything but local Supabase.
 */
import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const PHOTOS = { kerala: 'kerala.jpg', punjab: 'punjab_1.jpg', rajasthan: 'rajasthan.jpg' };

for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
let host = '';
try {
  host = new URL(url).hostname;
} catch {
  /* reported below */
}
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`Refusing: NEXT_PUBLIC_SUPABASE_URL is not local Supabase ("${url || 'unset'}").`);
  process.exit(2);
}
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing (apps/web/.env.local).');
  process.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false } });
for (const [slug, file] of Object.entries(PHOTOS)) {
  const path = `regions/${slug}/${file}`;
  const body = readFileSync(`design/mockups/assets/${file}`);
  const up = await db.storage.from('product-media').upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (up.error) throw new Error(`${slug}: upload failed: ${up.error.message}`);
  const { error } = await db.from('regions').update({ hero_image_path: path }).eq('slug', slug);
  if (error) throw new Error(`${slug}: ${error.message}`);
  console.log(`${slug}: ${path}`);
}
console.log('Region photos ready (local). The store cache refreshes within 5 minutes, or restart the web server.');

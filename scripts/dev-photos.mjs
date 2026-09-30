#!/usr/bin/env node
/**
 * scripts/dev-photos.mjs: puts the founder's photos (design/mockups/assets) into the LOCAL database and
 * storage, the same way the admin pages do: region photos (D-056, product-media/regions/<slug>/) and the
 * kasavu saree's four photos on the demo kasavu saree (D-057, product-media/products/<id>/).
 *
 *   pnpm dev:photos
 *
 * `check.mjs db` resets the local database, which forgets uploaded photos; run this again afterwards.
 * On the hosted dev database, upload them through the admin Regions and product pages instead.
 * Reads apps/web/.env.local; refuses anything but local Supabase.
 */
import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const PHOTOS = { kerala: 'kerala.jpg', punjab: 'punjab_1.jpg', rajasthan: 'rajasthan.jpg' };
const KASAVU = 'demo-kerala-kasavu-saree';
const KASAVU_PHOTOS = [
  ['Kasavu_main.jpg', 'image/jpeg', 'Kasavu saree with its gold border, spread out on the grass, worn seated'],
  ['kasavu_front_full.png', 'image/png', 'Kasavu saree, full length, front'],
  ['kasavu_back_full.png', 'image/png', 'Kasavu saree, full length, back, the gold pallu over the shoulder'],
  ['kasavu_closeup.png', 'image/png', 'Close-up of the kasavu saree gold border and weave'],
];

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
const { data: product, error: productError } = await db.from('products').select('id').eq('slug', KASAVU).maybeSingle();
if (productError) throw new Error(productError.message);
if (product) {
  const removed = await db.from('product_media').delete().eq('product_id', product.id);
  if (removed.error) throw new Error(removed.error.message);
  for (const [i, [file, type, alt]] of KASAVU_PHOTOS.entries()) {
    const path = `products/${product.id}/${file.toLowerCase()}`;
    const up = await db.storage
      .from('product-media')
      .upload(path, readFileSync(`design/mockups/assets/${file}`), { contentType: type, upsert: true });
    if (up.error) throw new Error(`${file}: upload failed: ${up.error.message}`);
    const row = { product_id: product.id, storage_path: path, alt_text: alt, sort_order: i, is_primary: i === 0 };
    const { error } = await db.from('product_media').insert(row);
    if (error) throw new Error(`${file}: ${error.message}`);
  }
  console.log(`${KASAVU}: ${KASAVU_PHOTOS.length} photos`);
}
console.log('Photos ready (local). The store cache refreshes within 5 minutes, or restart the web server.');

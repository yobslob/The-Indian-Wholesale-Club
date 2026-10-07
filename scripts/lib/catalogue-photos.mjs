/**
 * Uploads catalogue/photos (catalogue/README.md) the way the admin pages do: <region>/_region/ (the first file is the
 * state's main photo, the rest its album) and <region>/<product>/ (file-name order, the first is the main photo; alt
 * text from alt.txt; a free-licence photo's attribution from credit.json, D-078). Used by dev-photos.mjs (local) and
 * demo.mjs (the demo round, any database the founder points it at).
 *
 * `prefix` is put in front of every region file name, so the demo round's region photos can be found and removed
 * again (`demo-`); product photos live under products/<id>/ and go with their product.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';

const ROOT = 'catalogue/photos';
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const typeOf = (f) => TYPES[f.slice(f.lastIndexOf('.')).toLowerCase()];
const images = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => typeOf(f))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    : [];
const altTexts = (dir) =>
  Object.fromEntries(
    (existsSync(`${dir}/alt.txt`) ? readFileSync(`${dir}/alt.txt`, 'utf8').split(/\r?\n/) : [])
      .map((line) => line.match(/^\s*([^:]+?)\s*:\s*(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
/** "<title>" by <creator> is licensed under CC BY 2.0. (Openverse's attribution, without its "To view a copy" tail.) */
const credits = (dir) => {
  if (!existsSync(`${dir}/credit.json`)) return {};
  const raw = JSON.parse(readFileSync(`${dir}/credit.json`, 'utf8'));
  return Object.fromEntries(
    Object.entries(raw).map(([file, c]) => [file, String(c.text ?? '').replace(/\s*To view a copy of this license.*$/s, '').slice(0, 500)]),
  );
};

/** One album photo (migration 10): upload under regions/<slug>/album/ and add or update its row by path. */
export async function addAlbumPhoto(db, slug, file, body, contentType, alt, sortOrder) {
  const path = `regions/${slug}/album/${file.toLowerCase()}`;
  const up = await db.storage.from('product-media').upload(path, body, { contentType, upsert: true });
  if (up.error) throw new Error(`${slug} album: upload failed: ${up.error.message}`);
  const { data: region } = await db.from('regions').select('id').eq('slug', slug).single();
  const { error } = await db
    .from('region_photos')
    .upsert({ region_id: region.id, storage_path: path, alt_text: alt, sort_order: sortOrder }, { onConflict: 'storage_path' });
  if (error) throw new Error(`${slug} album: ${error.message}`);
}

/** Uploads the photos of the given regions (all folders when omitted). Returns what it did. */
export async function uploadCataloguePhotos(db, { regions, prefix = '', log = console.log } = {}) {
  let productsWithPhotos = 0;
  const skipped = [];
  const folders = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => statSync(`${ROOT}/${d}`).isDirectory()) : [];
  for (const region of folders.filter((r) => !regions || regions.includes(r))) {
    const regionPhotos = images(`${ROOT}/${region}/_region`);
    if (regionPhotos.length > 0) {
      const file = regionPhotos[0];
      const path = `regions/${region}/${prefix}${file.toLowerCase()}`;
      const up = await db.storage
        .from('product-media')
        .upload(path, readFileSync(`${ROOT}/${region}/_region/${file}`), { contentType: typeOf(file), upsert: true });
      if (up.error) throw new Error(`${region}: upload failed: ${up.error.message}`);
      const { error } = await db.from('regions').update({ hero_image_path: path }).eq('slug', region);
      if (error) throw new Error(`${region}: ${error.message}`);
      const alts = altTexts(`${ROOT}/${region}/_region`);
      for (const [i, extra] of regionPhotos.slice(1).entries()) {
        const body = readFileSync(`${ROOT}/${region}/_region/${extra}`);
        await addAlbumPhoto(db, region, `${prefix}${extra}`, body, typeOf(extra), alts[extra] ?? `${region}, album photo ${i + 1}`, 100 + i);
      }
      log(`${region}: main photo ${file}${regionPhotos.length > 1 ? `, ${regionPhotos.length - 1} album photo(s)` : ''}`);
    }
    for (const folder of readdirSync(`${ROOT}/${region}`).filter((d) => d !== '_region')) {
      const dir = `${ROOT}/${region}/${folder}`;
      const files = statSync(dir).isDirectory() ? images(dir) : [];
      if (files.length === 0) continue;
      const slug = `${region}-${folder}`;
      const { data: listing, error: findError } = await db.from('products').select('id, name').eq('slug', slug).maybeSingle();
      if (findError) throw new Error(findError.message);
      if (!listing) {
        skipped.push(dir);
        continue;
      }
      const alts = altTexts(dir);
      const credit = credits(dir);
      const removed = await db.from('product_media').delete().eq('product_id', listing.id);
      if (removed.error) throw new Error(removed.error.message);
      for (const [i, file] of files.entries()) {
        const path = `products/${listing.id}/${file.toLowerCase()}`;
        const up = await db.storage
          .from('product-media')
          .upload(path, readFileSync(`${dir}/${file}`), { contentType: typeOf(file), upsert: true });
        if (up.error) throw new Error(`${dir}/${file}: upload failed: ${up.error.message}`);
        const row = {
          product_id: listing.id,
          storage_path: path,
          alt_text: alts[file] ?? `${listing.name}, photo ${i + 1} of ${files.length}`,
          sort_order: i,
          is_primary: i === 0,
          credit: credit[file] || null,
        };
        const { error } = await db.from('product_media').insert(row);
        if (error) throw new Error(`${dir}/${file}: ${error.message}`);
      }
      productsWithPhotos += 1;
    }
  }
  return { productsWithPhotos, skipped };
}

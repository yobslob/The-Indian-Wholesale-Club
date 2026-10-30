import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { copyFor, type ProductType } from '@repo/shared/domain';

import { cursorFile, itemDir, readItem, typeDir, writeItem, type Item } from './items';
import { errorText, log } from './log';

import type { Db } from './db';
import type { Store } from './store';

/**
 * `fetch`: the next listings with photos to do, each photo's 1200 copy from the photo store (the original is not
 * kept, D-141) saved as before.png with its item.json. Pages on from where the last fetch stopped (`--again` starts
 * over: photos already here are skipped, so only the ones not done, a failed one, come back). The active house
 * models go to out/house-models.json for the GPU step.
 */
export async function fetchPhotos(
  out: string,
  db: Db,
  store: Store,
  type: ProductType,
  opts: { limit: number; again: boolean },
): Promise<number> {
  mkdirSync(typeDir(out, type), { recursive: true });
  const cursor = cursorFile(out, type);
  let after = !opts.again && existsSync(cursor) ? readFileSync(cursor, 'utf8').trim() || null : null;
  let got = 0;
  while (got < opts.limit) {
    const plan = await db.plan(type, after, 25);
    writeFileSync(join(out, 'house-models.json'), `${JSON.stringify(plan.house_models, null, 2)}\n`);
    if (!plan.listings.length) {
      log(`${type}: no more listings with photos to do`);
      break;
    }
    for (const listing of plan.listings) {
      const fetched: { dir: string; item: Item; png: Buffer }[] = [];
      let failed = false;
      for (const photo of listing.photos) {
        const item: Item = {
          media_id: photo.id,
          product_id: listing.product_id,
          type: type as Item['type'],
          name: listing.name,
          category: listing.category,
          wears: listing.wears,
          path: photo.path,
          alt: photo.alt,
          main: photo.main,
        };
        const dir = itemDir(out, item);
        const had = readItem(dir);
        // a photo changed while it waited (left alone by publish) comes back as the photo it is now
        if (had && !(had.stale && had.path !== photo.path)) continue;
        try {
          const bytes = await store.get(`product-media/${copyFor(photo.path, 1200)}`);
          // a shop's transparent backdrop made white: the GPU step reads RGB, where it would turn black
          fetched.push({ dir, item, png: await sharp(bytes).flatten({ background: '#ffffff' }).png().toBuffer() });
        } catch (error) {
          failed = true;
          log(`  ${listing.name}: ${errorText(error)}`);
        }
      }
      // clothing goes live a whole listing at a time (publish.ts): a photo missing here would keep the shop's face
      // beside the house model's, so the listing waits for `fetch --again`
      if (failed && type === 'clothing') {
        log(`  ${listing.name}: not fetched (a photo could not be read)`);
        fetched.length = 0;
      }
      for (const f of fetched) {
        rmSync(f.dir, { recursive: true, force: true });
        mkdirSync(f.dir, { recursive: true });
        writeFileSync(join(f.dir, 'before.png'), f.png);
        writeItem(f.dir, f.item);
        got += 1;
      }
      after = listing.product_id;
      writeFileSync(cursor, after);
      if (got >= opts.limit) break;
    }
  }
  log(`${type}: ${got} photos fetched into ${typeDir(out, type)}`);
  return got;
}

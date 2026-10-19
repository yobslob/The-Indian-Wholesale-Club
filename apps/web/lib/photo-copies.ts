import 'server-only';

import sharp from 'sharp';

import { canHaveCopies, copiesPath, copyFor, COPY_WIDTHS, PHOTO_CACHE_CONTROL } from '@repo/shared/domain';

import { errorMessage, logger } from '@/lib/logger';

import type { IwcClient } from '@repo/db';

/**
 * Fixed-size copies, made once when a photo is stored (D-140, the photo fix; names in packages/shared media.ts). The
 * store then serves every photo from Supabase's CDN at the width it is drawn, at no cost per view. The same settings
 * are in scripts/photo-copies.mjs and the sourcing runner (tools/sourcing-runner/src/db.ts).
 */

type Bucket = 'product-media' | 'review-media';

/** WebP at quality 80 with full-resolution colour on edges (smartSubsample), so weaves, prints and zari stay crisp. */
const WEBP = { quality: 80, smartSubsample: true } as const;

const exists = (message: string): boolean => /exists|duplicate/i.test(message);

async function writeCopies(client: IwcClient, bucket: Bucket, target: string, bytes: Buffer): Promise<void> {
  // rotate(): a phone photo's EXIF turn is applied, since the copies carry no EXIF
  const image = sharp(bytes, { failOn: 'error' }).rotate();
  await Promise.all(
    COPY_WIDTHS.map(async (width) => {
      const body = await image.clone().resize({ width, withoutEnlargement: true }).webp(WEBP).toBuffer();
      const { error } = await client.storage
        .from(bucket)
        .upload(copyFor(target, width), body, { contentType: 'image/webp', cacheControl: PHOTO_CACHE_CONTROL });
      if (error && !exists(error.message)) throw new Error(error.message);
    }),
  );
}

/**
 * Stores a new photo with its copies: the copies first, then the photo at its `c/` path, so a recorded path always has
 * them. Returns the path to record. A photo the copies can't be made from (a file sharp can't read) is stored as it is
 * at `path` and shows as it is.
 */
export async function storePhoto(
  client: IwcClient,
  bucket: Bucket,
  path: string,
  file: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bytes =
    file instanceof Blob ? Buffer.from(await file.arrayBuffer()) : file instanceof Uint8Array ? Buffer.from(file) : Buffer.from(file);
  let target = path;
  if (canHaveCopies(path)) {
    try {
      await writeCopies(client, bucket, copiesPath(path), bytes);
      target = copiesPath(path);
    } catch (error) {
      logger.warn('photo.copies_failed', { path, error: errorMessage(error) });
    }
  }
  const { error } = await client.storage.from(bucket).upload(target, bytes, { contentType, cacheControl: PHOTO_CACHE_CONTROL });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return target;
}

/**
 * Copies for a photo already stored at `path`; returns its `c/` path, or `path` when they can't be made. `move` is for a
 * photo no page names yet (a new listing's upload): the file moves into `c/`. Otherwise it is copied there and the old
 * file stays for pages cached with its old address (`pnpm photos:copies -- --clean` removes those later).
 */
export async function withCopies(client: IwcClient, bucket: Bucket, path: string, move = false): Promise<string> {
  if (!canHaveCopies(path) || copiesPath(path) === path) return path;
  const target = copiesPath(path);
  try {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message ?? 'missing');
    await writeCopies(client, bucket, target, Buffer.from(await data.arrayBuffer()));
    const done = move ? await client.storage.from(bucket).move(path, target) : await client.storage.from(bucket).copy(path, target);
    if (done.error && !exists(done.error.message)) throw new Error(done.error.message);
    return target;
  } catch (error) {
    logger.warn('photo.copies_failed', { path, error: errorMessage(error) });
    return path;
  }
}

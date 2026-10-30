import 'server-only';

import sharp from 'sharp';

import {
  canHaveCopies,
  COPY_WIDTHS,
  hasCopies,
  PHOTO_CACHE_CONTROL,
  PRINT_BLUR,
  PRINT_SIZE,
  storedPath,
  storeKeys,
  type PhotoPrint,
} from '@repo/shared/domain';

import { errorMessage, logger } from '@/lib/logger';
import { photoStoreReady, putPhotoFile, removePhotoFiles } from '@/lib/photo-store';

import type { IwcClient } from '@repo/db';

/**
 * Storing a photo (D-140, the photo fix; names in packages/shared media.ts): two AVIF copies, 640 and 1200 pixels wide,
 * go to the photo store (lib/photo-store.ts) and the photo is recorded with its `s/` path; the original is not kept.
 * The same settings are in scripts/photo-copies.mjs and the sourcing runner (tools/sourcing-runner/src/photo-store.ts).
 * Without a photo store (local development) a photo stays in Supabase's storage and shows as it is.
 */

type Bucket = 'product-media' | 'review-media';

/**
 * AVIF: a third of the bytes of the shops' JPEGs at the same look (checked on 60 live photos, 2026-10-20). Quality 60 at
 * 640 and 55 at 1200 keep weaves, stitching and print edges; effort 2 encodes six times faster than 4 for 5 % more bytes.
 */
const AVIF = { 640: { quality: 60, effort: 2 }, 1200: { quality: 55, effort: 2 } } as const;

/** The copies of a photo, in COPY_WIDTHS order. */
export async function makeCopies(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>[]> {
  // rotate(): a phone photo's EXIF turn is applied, since the copies carry no EXIF
  const image = sharp(bytes, { failOn: 'error' }).rotate();
  return Promise.all(
    COPY_WIDTHS.map(async (width) => new Uint8Array(await image.clone().resize({ width, withoutEnlargement: true }).avif(AVIF[width]).toBuffer())),
  );
}

/** A photo's print, to spot the same picture saved twice (D-142, packages/shared same-picture.ts); null if unreadable. */
export async function photoPrint(bytes: Uint8Array): Promise<PhotoPrint | null> {
  try {
    const image = sharp(bytes, { failOn: 'error' });
    const { width, height, orientation } = await image.metadata();
    if (!width || !height) return null;
    const turned = (orientation ?? 1) >= 5;
    const pixels = await image
      .rotate()
      .flatten({ background: '#fff' })
      .resize(PRINT_SIZE, PRINT_SIZE, { fit: 'fill' })
      .blur(PRINT_BLUR)
      .removeAlpha()
      .raw()
      .toBuffer();
    return { width: turned ? height : width, height: turned ? width : height, pixels: new Uint8Array(pixels) };
  } catch {
    return null;
  }
}

async function putCopies(bucket: Bucket, path: string, bytes: Uint8Array): Promise<void> {
  const copies = await makeCopies(bytes);
  const keys = storeKeys(bucket, path);
  const written = await Promise.allSettled(copies.map((body, i) => putPhotoFile(keys[i]!, body, 'image/avif')));
  const failed = written.find((r) => r.status === 'rejected');
  if (failed) {
    // one copy without the other is never recorded, so never shown: it goes too
    await removePhotoFiles(keys).catch(() => undefined);
    throw failed.reason;
  }
}

/** Supabase files a photo not yet stored may have: the photo, and the WebP copies made before 2026-10-20. */
function supabaseFiles(path: string): string[] {
  if (!/\/c\/[^/]+$/.test(path)) return [path];
  return [path, ...[320, 640, 1280].map((w) => path.replace(/\.(jpe?g|png|webp|avif)$/i, `.w${w}.webp`))];
}

/**
 * Stores a new photo: its copies in the photo store, and returns the `s/` path to record. Without a photo store, or if
 * the copies can't be made (a file sharp can't read), the photo goes to Supabase's storage at `path` and shows as it is.
 */
export async function storePhoto(
  client: IwcClient,
  bucket: Bucket,
  path: string,
  file: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bytes = file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array(file);
  if (photoStoreReady() && canHaveCopies(path)) {
    try {
      await putCopies(bucket, storedPath(path), bytes);
      return storedPath(path);
    } catch (error) {
      logger.warn('photo.store_failed', { path, error: errorMessage(error) });
    }
  }
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType, cacheControl: PHOTO_CACHE_CONTROL });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

/**
 * Stores a photo that is in Supabase's storage at `path` (a new listing's upload, a photo from the phone or the
 * runner, an older photo): its copies go to the photo store and its Supabase files are removed. Returns the `s/` path
 * to record, or `path` when it stays where it is (no photo store, or it can't be read).
 */
export async function withCopies(client: IwcClient, bucket: Bucket, path: string): Promise<string> {
  if (!photoStoreReady() || !canHaveCopies(path) || hasCopies(path)) return path;
  try {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error || !data) throw new Error(error?.message ?? 'missing');
    await putCopies(bucket, storedPath(path), new Uint8Array(await data.arrayBuffer()));
    return storedPath(path);
  } catch (error) {
    logger.warn('photo.store_failed', { path, error: errorMessage(error) });
    return path;
  }
}

/** Removes a photo's files from Supabase's storage once its row points at the store (or the row is gone). */
export async function removeSupabaseFiles(client: IwcClient, bucket: Bucket, paths: string[]): Promise<void> {
  const files = paths.filter((p) => !hasCopies(p)).flatMap(supabaseFiles);
  if (files.length) await client.storage.from(bucket).remove(files);
}

/** Removes photos wherever they are: copies in the photo store, files in Supabase's storage. */
export async function removePhotos(client: IwcClient, bucket: Bucket, paths: string[]): Promise<void> {
  const stored = paths.filter(hasCopies);
  if (stored.length) await removePhotoFiles(stored.flatMap((p) => storeKeys(bucket, p)));
  await removeSupabaseFiles(client, bucket, paths);
}

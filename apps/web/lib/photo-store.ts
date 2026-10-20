import 'server-only';

import { AwsClient } from 'aws4fetch';

import { PHOTO_CACHE_CONTROL } from '@repo/shared/domain';

/**
 * The photo store (D-140, packages/shared media.ts): any S3-compatible bucket, Cloudflare R2 in production (10 GB free,
 * no charge for traffic). Written only by the server, with keys that never reach a browser (ops.md §Photos):
 *   PHOTO_STORE_S3_URL      the bucket's S3 address, https://<account>.r2.cloudflarestorage.com/<bucket>
 *   PHOTO_STORE_KEY_ID, PHOTO_STORE_SECRET   an R2 API token for that bucket (Object Read & Write)
 *   PHOTO_STORE_PUBLIC_URL  where the bucket is read publicly, https://pub-<id>.r2.dev (next.config.js routes /media/s/)
 *   PHOTO_STORE_REGION      optional; `auto` for R2 (`local` for local Supabase's S3, ops.md)
 * Without them, photos stay in Supabase's storage as before (local development, tests).
 */

let client: AwsClient | null = null;

function store(): { s3: AwsClient; base: string } | null {
  const base = process.env.PHOTO_STORE_S3_URL?.replace(/\/+$/, '');
  const accessKeyId = process.env.PHOTO_STORE_KEY_ID;
  const secretAccessKey = process.env.PHOTO_STORE_SECRET;
  if (!base || !accessKeyId || !secretAccessKey || !process.env.PHOTO_STORE_PUBLIC_URL) return null;
  client ??= new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: process.env.PHOTO_STORE_REGION || 'auto' });
  return { s3: client, base };
}

/** Whether the photo store is set up here. */
export const photoStoreReady = (): boolean => store() !== null;

const keyUrl = (base: string, key: string): string => `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** Writes one file (a new key each time: photos are never overwritten, so a year's cache is right). */
export async function putPhotoFile(key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  const s = store();
  if (!s) throw new Error('the photo store is not set up');
  const res = await s.s3.fetch(keyUrl(s.base, key), {
    method: 'PUT',
    body,
    headers: { 'content-type': contentType, 'cache-control': `public, max-age=${PHOTO_CACHE_CONTROL}, immutable` },
  });
  if (!res.ok) throw new Error(`photo store: ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/** Removes files (a key that isn't there is fine). */
export async function removePhotoFiles(keys: string[]): Promise<void> {
  const s = store();
  if (!s) return;
  await Promise.all(
    keys.map(async (key) => {
      const res = await s.s3.fetch(keyUrl(s.base, key), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`photo store: ${res.status}`);
    }),
  );
}

/** Reads a file through the bucket's public address (the JPEG route). */
export async function readPhotoFile(key: string): Promise<Uint8Array | null> {
  const pub = process.env.PHOTO_STORE_PUBLIC_URL?.replace(/\/+$/, '');
  if (!pub) return null;
  const res = await fetch(keyUrl(pub, key), { cache: 'no-store' });
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

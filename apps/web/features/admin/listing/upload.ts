'use client';

import { PHOTO_CACHE_CONTROL } from '@repo/shared/domain';

import { browserClient } from '@/lib/supabase/browser';

/** Long enough edge for a sharp product page on any screen; small enough to upload from a shop (as the app does). */
const MAX_EDGE = 2400;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];

/**
 * A photo shrunk to at most 2400 px on its longest side, as JPEG, in the browser. A photo the browser can't open (some
 * HEIC files) is sent as it is when it is a type the store shows; otherwise it is refused.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!TYPES.includes(file.type)) throw new Error('not a photo (JPEG, PNG, WebP or AVIF)');
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (blob) return blob;
  } catch {
    // fall through to the file as it is
  }
  if (['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) return file;
  throw new Error('this photo could not be read; save it as JPEG and try again');
}

/**
 * Uploads one listing photo with the admin's own session (storage policy "iwc admin insert", admin only) and reports
 * its progress. New listings' photos go up as soon as they are dropped, into `products/drafts/<batch>/`; saving the
 * listing records them on the product (product_media).
 */
export async function uploadPhoto(blob: Blob, batch: string, onProgress: (share: number) => void): Promise<string> {
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('signed out: sign in again');
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/avif' ? 'avif' : 'jpg';
  const path = `products/drafts/${batch}/${crypto.randomUUID()}.${ext}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/product-media/${path}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('content-type', blob.type || 'image/jpeg');
    xhr.setRequestHeader('cache-control', `max-age=${PHOTO_CACHE_CONTROL}`);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('upload failed: check the connection'));
    xhr.send(blob);
  });
  onProgress(1);
  return path;
}

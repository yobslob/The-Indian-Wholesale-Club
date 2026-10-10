'use client';

import { checkPhoto, type PhotoChecks } from '@repo/shared/vendor';

import { browserClient } from '@/lib/supabase/browser';

const MAX_EDGE = 2400;        // as the admin's listing photos: sharp on any screen, small enough to send from a shop
const OVERVIEW = 256;
const CROP = 512;

function grey(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8ClampedArray {
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * (rgba[i * 4] ?? 0) + 0.587 * (rgba[i * 4 + 1] ?? 0) + 0.114 * (rgba[i * 4 + 2] ?? 0);
  }
  return out;
}

/**
 * Reads a photo the vendor just took: the instant check (@repo/shared/vendor: size, light, blur on a full-resolution
 * centre crop) and the photo shrunk to 2400 px as JPEG for sending.
 */
export async function readPhoto(file: File): Promise<{ blob: Blob; checks: PhotoChecks; preview: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = bitmap;

  const small = document.createElement('canvas');
  const s = OVERVIEW / Math.max(width, height);
  small.width = Math.max(1, Math.round(width * s));
  small.height = Math.max(1, Math.round(height * s));
  const sctx = small.getContext('2d', { willReadFrequently: true });
  sctx?.drawImage(bitmap, 0, 0, small.width, small.height);

  const side = Math.min(CROP, width, height);
  const crop = document.createElement('canvas');
  crop.width = crop.height = side;
  const cctx = crop.getContext('2d', { willReadFrequently: true });
  cctx?.drawImage(bitmap, Math.floor((width - side) / 2), Math.floor((height - side) / 2), side, side, 0, 0, side, side);

  const checks = checkPhoto({
    width,
    height,
    overview: sctx ? grey(sctx, small.width, small.height) : new Uint8ClampedArray(),
    crop: cctx ? grey(cctx, side, side) : new Uint8ClampedArray(),
    cropSide: side,
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const out = document.createElement('canvas');
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  out.getContext('2d')?.drawImage(bitmap, 0, 0, out.width, out.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob) throw new Error('photo_unreadable');
  return { blob, checks, preview: URL.createObjectURL(blob) };
}

/** Sends one photo to the vendor's own folder (storage rule: vendor_may_upload), with progress for a slow line. */
export async function sendPhoto(blob: Blob, path: string, onProgress: (share: number) => void): Promise<void> {
  const { data } = await browserClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('signed_out');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/storage/v1/object/vendor-uploads/${path}`);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
    xhr.setRequestHeader('content-type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload_${xhr.status}`)));
    xhr.onerror = () => reject(new Error('upload_network'));
    xhr.send(blob);
  });
  onProgress(1);
}

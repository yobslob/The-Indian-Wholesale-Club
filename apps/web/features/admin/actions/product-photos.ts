'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addProductMedia,
  deleteProductMedia,
  getAdminProduct,
  getProductMedia,
  setPrimaryProductMedia,
} from '@repo/db/admin';

import { removePhotos, storePhoto } from '@/lib/photo-copies';

import { requireAdminAction } from '../guard';
import { refreshListings } from '../refresh-listings';

const id = z.string().uuid();
const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function done(client: Parameters<typeof refreshListings>[0], productId: string): Promise<void> {
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
}

/**
 * Adds a product photo (design.md §Visual system 5; the phone camera flow comes in C3). Alt text is required
 * (design.md §Accessibility). Stored in product-media/products/<product>/ with the admin's own session; the
 * first photo becomes the main one.
 */
export async function uploadProductPhotoAction(productId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const pid = id.parse(productId);
  const altText = z
    .string()
    .trim()
    .min(3, 'describe the photo for people who cannot see it (alt text)')
    .max(200)
    .parse(form.get('altText'));
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) throw new Error('choose a photo to upload');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('the photo must be a JPEG, PNG, WebP or AVIF image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('the photo must be 8 MB or smaller');

  const product = await getAdminProduct(client, pid);
  if (!product) throw new Error('product not found');
  const path = await storePhoto(client, 'product-media', `products/${pid}/${crypto.randomUUID()}.${ext}`, file, file.type);
  const order = product.media.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1;
  await addProductMedia(client, {
    product_id: pid,
    storage_path: path,
    alt_text: altText,
    sort_order: order,
    is_primary: product.media.length === 0,
  });
  await done(client, pid);
}

export async function setMainPhotoAction(productId: string, mediaId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await setPrimaryProductMedia(client, id.parse(productId), id.parse(mediaId));
  await done(client, productId);
}

/** Removes the photo and its file. Removing the main photo makes the next one main. */
export async function deleteProductPhotoAction(productId: string, mediaId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const media = await getProductMedia(client, id.parse(mediaId));
  if (!media || media.product_id !== id.parse(productId)) throw new Error('photo not found');
  await deleteProductMedia(client, media.id);
  try {
    await removePhotos(client, 'product-media', [media.storage_path]);
  } catch (error) {
    throw new Error(`the photo was removed from the product, but its files could not be deleted: ${String(error)}`);
  }
  if (media.is_primary) {
    const product = await getAdminProduct(client, productId);
    const next = product?.media.slice().sort((a, b) => a.sort_order - b.sort_order)[0];
    if (next) await setPrimaryProductMedia(client, productId, next.id);
  }
  await done(client, productId);
}

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { addHomePhoto, orderHomePhotos, removeHomePhoto, updateHomePhotoAlt } from '@repo/db/admin';

import { homeTag } from '@/features/catalog/data';
import { errorMessage } from '@/lib/logger';
import { removePhotos, storePhoto } from '@/lib/photo-copies';

import { requireAdminAction } from '../guard';

/**
 * Home's photos (D-169): the founder's own pictures for Home's mosaic, added many at a time, put in order and removed
 * in the admin's Home photos page. Only Home's cache entry is refreshed (homeTag), once per batch of uploads, not the
 * whole store (monitoring.md §1: page-cache writes).
 */

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const alt = z.string().trim().min(1, 'describe the photo').max(300);
const id = z.string().uuid();
const PAGE = '/admin/home-photos';

/** One photo of a batch (the page sends them one by one, so each stays under the action's size limit). */
export async function uploadHomePhotoAction(form: FormData): Promise<{ error: string | null }> {
  try {
    const { client } = await requireAdminAction();
    const line = alt.parse(form.get('alt'));
    const file = form.get('image');
    if (!(file instanceof File) || file.size === 0) return { error: 'no photo' };
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { error: 'must be a JPEG, PNG, WebP or AVIF image' };
    if (file.size > MAX_IMAGE_BYTES) return { error: 'must be 8 MB or smaller' };
    const path = await storePhoto(client, 'product-media', `home/album/${crypto.randomUUID()}.${ext}`, file, file.type);
    await addHomePhoto(client, path, line);
    return { error: null };
  } catch (error) {
    return { error: error instanceof z.ZodError ? (error.issues[0]?.message ?? 'not valid') : errorMessage(error) };
  }
}

/** After a batch of uploads: Home shows them on its next visit. */
export async function publishHomePhotosAction(): Promise<void> {
  await requireAdminAction();
  revalidateTag(homeTag);
  revalidatePath(PAGE);
}

/** The order as the page's grid shows it, first tile first. */
export async function orderHomePhotosAction(ids: string[]): Promise<void> {
  const { client } = await requireAdminAction();
  await orderHomePhotos(client, z.array(id).max(500).parse(ids));
  revalidateTag(homeTag);
  revalidatePath(PAGE);
}

export async function updateHomePhotoAltAction(photoId: string, text: string): Promise<void> {
  const { client } = await requireAdminAction();
  await updateHomePhotoAlt(client, id.parse(photoId), alt.parse(text));
  revalidateTag(homeTag);
  revalidatePath(PAGE);
}

export async function removeHomePhotoAction(photoId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const path = await removeHomePhoto(client, id.parse(photoId));
  if (path) await removePhotos(client, 'product-media', [path]);
  revalidateTag(homeTag);
  revalidatePath(PAGE);
}

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import {
  addRegionPhoto,
  approveRegionContent,
  getRegionAdmin,
  removeRegionPhoto,
  updateRegion,
} from '@repo/db/admin';
import { PHOTO_CACHE_CONTROL, worstContrast } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

const id = z.string().uuid();

/** The greeting scripts the admin can pick (ISO 15924): the ones the store has a font for, plus Latin. */
const GREETING_SCRIPTS = ['Deva', 'Beng', 'Guru', 'Gujr', 'Orya', 'Taml', 'Telu', 'Knda', 'Mlym', 'Latn'] as const;
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** The backgrounds a region accent colours text on (design.md §Visual system 2). */
const ACCENT_BACKGROUNDS = [tokens.colors.canvas, tokens.colors.surface, tokens.colors.paper];

const accentColor = z
  .string()
  .trim()
  .regex(/^(#[0-9A-Fa-f]{6})?$/, 'accent colour must look like #1A2B3C')
  .transform((v) => v.toUpperCase() || null)
  .superRefine((v, ctx) => {
    if (!v) return;
    const { ratio, passes } = worstContrast(v, ACCENT_BACKGROUNDS);
    if (!passes)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `accent colour ${v} is too light for text (${ratio.toFixed(2)} : 1, needs 4.5 : 1); pick a darker shade`,
      });
  });

// ---------------------------------------------------------------- regions (D-019: text shows only once approved)

export async function updateRegionAction(regionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      greetingNative: optional(80),
      // ISO 15924, one of the scripts the store has a greeting font for (features/regions/script-fonts.ts).
      greetingScript: z
        .enum(['', ...GREETING_SCRIPTS])
        .transform((v) => v || null),
      greetingLatin: optional(80),
      greetingMeaning: optional(120),
      tagline: optional(200),
      story: optional(4000),
      accentColor,
      isLive: z.literal('on').optional(),
    })
    .parse(Object.fromEntries(form));
  await updateRegion(client, id.parse(regionId), {
    greeting_native: input.greetingNative,
    greeting_script: input.greetingScript,
    greeting_latin: input.greetingLatin,
    greeting_meaning: input.greetingMeaning,
    tagline: input.tagline,
    story: input.story,
    accent_color: input.accentColor,
    is_live: input.isLive === 'on',
    // Any text edit needs a fresh approval before customers see it (D-019).
    content_status: 'draft',
  });
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/regions');
}

export async function approveRegionAction(regionId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await approveRegionContent(client, id.parse(regionId));
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/regions');
}

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * The region's main photo (region page hero, the home page stamp). Stored in the public product-media bucket
 * under regions/<slug>/ with the admin's own session (storage policy "iwc admin insert"). A photo is not
 * drafted text, so it does not send the region back to draft (D-019 is about text).
 */
export async function uploadRegionImageAction(regionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const regionIdOk = id.parse(regionId);
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) throw new Error('choose a photo to upload');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('the photo must be a JPEG, PNG, WebP or AVIF image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('the photo must be 8 MB or smaller');

  const region = await getRegionAdmin(client, regionIdOk);
  if (!region) throw new Error('region not found');
  const path = `regions/${region.slug}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('product-media').upload(path, file, { contentType: file.type, cacheControl: PHOTO_CACHE_CONTROL });
  if (error) throw new Error(`upload failed: ${error.message}`);
  await updateRegion(client, regionIdOk, { hero_image_path: path });
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/regions/${regionIdOk}`);
}

/** A photo for the region album (D-051), with the alt text a screen reader says. Stored under regions/<slug>/album/. */
export async function uploadAlbumPhotoAction(regionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const regionIdOk = id.parse(regionId);
  const alt = z.string().trim().min(1, 'describe the photo (alt text)').max(300).parse(form.get('alt'));
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) throw new Error('choose a photo to upload');
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('the photo must be a JPEG, PNG, WebP or AVIF image');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('the photo must be 8 MB or smaller');

  const region = await getRegionAdmin(client, regionIdOk);
  if (!region) throw new Error('region not found');
  const path = `regions/${region.slug}/album/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('product-media').upload(path, file, { contentType: file.type, cacheControl: PHOTO_CACHE_CONTROL });
  if (error) throw new Error(`upload failed: ${error.message}`);
  await addRegionPhoto(client, regionIdOk, path, alt);
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/regions/${regionIdOk}`);
}

export async function removeAlbumPhotoAction(regionId: string, photoId: string): Promise<void> {
  const { client } = await requireAdminAction();
  const path = await removeRegionPhoto(client, id.parse(photoId));
  if (path) await client.storage.from('product-media').remove([path]);
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/regions/${id.parse(regionId)}`);
}

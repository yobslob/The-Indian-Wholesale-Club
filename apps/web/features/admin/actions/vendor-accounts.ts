'use server';

import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { z } from 'zod';

import {
  newVendorSignInCode,
  saveHouseModel,
  setHouseModelActive,
  setVendorAccountActive,
  setVendorAccountLanguage,
  updateJoinRequest,
} from '@repo/db/admin';
import { createVendorAccount } from '@repo/db/server';
import { isLanguage } from '@repo/shared/vendor';

import { siteUrl } from '@/lib/env';
import { serviceClient } from '@/lib/supabase/service';

import { requireAdminAction } from '../guard';

/** What the admin shows once: the link and its QR code (an SVG made here; nothing about it is stored). */
export type SignInCode = { link: string; qr: string; expiresDays: number };

async function codeFor(userId: string, days: number): Promise<SignInCode> {
  const { client } = await requireAdminAction();
  const code = await newVendorSignInCode(client, userId, days);
  const link = `${siteUrl()}/vendor/login?code=${encodeURIComponent(code)}`;
  const qr = await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { link, qr, expiresDays: days };
}

/**
 * A new vendor account for a shop (D-102): the auth user is made by the server (service role, after the admin check),
 * then its first one-time sign-in code. The COO shows the QR in the shop, or sends the link on WhatsApp.
 */
export async function createVendorAccountAction(vendorId: string, language: string): Promise<SignInCode> {
  const { user } = await requireAdminAction();
  const lang = isLanguage(language) ? language : 'hi';
  const userId = await createVendorAccount(serviceClient(), { vendorId: z.string().uuid().parse(vendorId), language: lang, createdBy: user.id });
  revalidatePath('/admin/vendors');
  return codeFor(userId, 7);
}

/** A fresh code for an existing account (a new phone, a lost link); the older unused one stops working. */
export async function newSignInCodeAction(userId: string, days: number): Promise<SignInCode> {
  return codeFor(z.string().uuid().parse(userId), z.number().int().min(1).max(30).parse(days));
}

export async function setVendorAccountActiveAction(userId: string, active: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await setVendorAccountActive(client, z.string().uuid().parse(userId), z.boolean().parse(active));
  revalidatePath('/admin/vendors');
}

export async function setVendorAccountLanguageAction(userId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const lang = String(form.get('language') ?? '');
  if (!isLanguage(lang)) throw new Error('unknown language');
  await setVendorAccountLanguage(client, z.string().uuid().parse(userId), lang);
  revalidatePath('/admin/vendors');
}

export async function setJoinRequestStatusAction(id: string, status: 'contacted' | 'accepted' | 'declined'): Promise<void> {
  const { client } = await requireAdminAction();
  await updateJoinRequest(client, z.string().uuid().parse(id), { status: z.enum(['contacted', 'accepted', 'declined']).parse(status) });
  revalidatePath('/admin/vendors');
}

// ---------------------------------------------------------------- house models (D-104)

const houseSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40),
  label: z.string().trim().min(1).max(60),
  wears: z.enum(['women', 'men']),
});

async function uploadPose(file: unknown, slug: string, pose: 'front' | 'back'): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new Error(`add the ${pose} photo`);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPEG, PNG or WebP');
  const { client } = await requireAdminAction();
  const path = `house-models/${slug}/${pose}-${crypto.randomUUID().slice(0, 8)}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
  const { error } = await client.storage.from('product-media').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

/** A house model (D-104): the founder's front pose and back pose, as two photos; the worker uses them as they are. */
export async function saveHouseModelAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const model = houseSchema.parse({ slug: form.get('slug'), label: form.get('label'), wears: form.get('wears') });
  const [front_path, back_path] = await Promise.all([
    uploadPose(form.get('front'), model.slug, 'front'),
    uploadPose(form.get('back'), model.slug, 'back'),
  ]);
  await saveHouseModel(client, { ...model, front_path, back_path });
  revalidatePath('/admin/house-models');
}

export async function setHouseModelActiveAction(id: string, active: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await setHouseModelActive(client, z.string().uuid().parse(id), z.boolean().parse(active));
  revalidatePath('/admin/house-models');
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addShopBillPhoto,
  ensureShopBill,
  markOrdered,
  removeShopBillPhoto,
  saveShopBill,
  setShopBillFinal,
  shopBillLineSchema,
  unmarkOrdered,
} from '@repo/db/admin';

import { errorMessage, logger } from '@/lib/logger';

import { requireAdminAction } from '../guard';

/**
 * Ordering sold pieces from their shops and the shop bill, invoice C (D-140, plan F3, F4). The screens change at once
 * and call these after (rule 0.1); each returns what went wrong instead of throwing, so the screen can roll back
 * and say so in a line.
 */

const id = z.string().uuid();
const BILL_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};
const MAX_BILL_BYTES = 8 * 1024 * 1024;

export type ActionResult = { ok: true } | { ok: false; error: string };

function refresh(orderIds: string[]): void {
  revalidatePath('/admin/to-order');
  revalidatePath('/admin');
  for (const o of new Set(orderIds)) revalidatePath(`/admin/orders/${o}`);
}

const fail = (scope: string, error: unknown): ActionResult => {
  logger.error(`admin.${scope}_failed`, { error: errorMessage(error) });
  const message = errorMessage(error);
  if (message.includes('pickup_not_pending')) return { ok: false, error: 'Already at the hub or no longer to order: reload to see it.' };
  if (message.includes('shop_bill_final')) return { ok: false, error: 'The bill is final: reopen it to change it.' };
  return { ok: false, error: 'That did not save. Try again.' };
};

/** Uploads one bill photo or PDF to the private vendor-docs bucket under shop-bills/; returns its path. */
async function uploadBill(client: Awaited<ReturnType<typeof requireAdminAction>>['client'], folder: string, file: File): Promise<string> {
  const ext = BILL_TYPES[file.type];
  if (!ext) throw new Error('bill_type');
  if (file.size === 0 || file.size > MAX_BILL_BYTES) throw new Error('bill_size');
  const path = `shop-bills/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('vendor-docs').upload(path, file, { contentType: file.type });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

/**
 * Mark pieces ordered: one or many (a whole shop's cart), each with what was paid, one shop order number and one
 * optional bill photo or PDF for all of them. Form fields: lines (JSON), ref, bill (file), orders (JSON order ids).
 */
export async function markOrderedAction(form: FormData): Promise<ActionResult> {
  const { client } = await requireAdminAction();
  try {
    const lines = z
      .array(z.object({ pickup: id, paid_paise: z.number().int().min(0).nullable() }))
      .min(1)
      .max(200)
      .parse(JSON.parse(String(form.get('lines') ?? '[]')));
    const orders = z.array(id).max(200).parse(JSON.parse(String(form.get('orders') ?? '[]')));
    const ref = z.string().trim().max(120).parse(form.get('ref') ?? '');
    const file = form.get('bill');
    const billPath = file instanceof File && file.size > 0 ? await uploadBill(client, new Date().toISOString().slice(0, 10), file) : undefined;
    await markOrdered(client, { lines, shopOrderRef: ref || undefined, billPath });
    refresh(orders);
    return { ok: true };
  } catch (error) {
    if (errorMessage(error) === 'bill_type') return { ok: false, error: 'The bill must be a photo (JPEG, PNG, WebP, HEIC) or a PDF.' };
    if (errorMessage(error) === 'bill_size') return { ok: false, error: 'The bill must be 8 MB or smaller.' };
    return fail('mark_ordered', error);
  }
}

export async function unmarkOrderedAction(pickupId: string, orderId: string): Promise<ActionResult> {
  const { client } = await requireAdminAction();
  try {
    await unmarkOrdered(client, id.parse(pickupId));
    refresh([id.parse(orderId)]);
    return { ok: true };
  } catch (error) {
    return fail('unmark_ordered', error);
  }
}

/** Saves the shop bill's rows and note (a draft); made with its rows on first use. */
export async function saveShopBillAction(orderId: string, lines: unknown, note: string): Promise<ActionResult> {
  const { client } = await requireAdminAction();
  try {
    const billId = await ensureShopBill(client, id.parse(orderId));
    await saveShopBill(client, billId, z.array(shopBillLineSchema).max(200).parse(lines), z.string().max(1000).parse(note));
    refresh([orderId]);
    return { ok: true };
  } catch (error) {
    return fail('save_shop_bill', error);
  }
}

export async function setShopBillFinalAction(orderId: string, final: boolean): Promise<ActionResult> {
  const { client } = await requireAdminAction();
  try {
    const billId = await ensureShopBill(client, id.parse(orderId));
    await setShopBillFinal(client, billId, final);
    refresh([orderId]);
    return { ok: true };
  } catch (error) {
    return fail('shop_bill_final', error);
  }
}

/** Adds photos or PDFs of the shop's bill (dropped, picked, taken with the camera or pasted). */
export async function uploadShopBillPhotosAction(orderId: string, form: FormData): Promise<ActionResult> {
  const { client, user } = await requireAdminAction();
  try {
    const order = id.parse(orderId);
    const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
    if (files.length === 0) return { ok: false, error: 'Choose a photo of the bill.' };
    const billId = await ensureShopBill(client, order);
    for (const file of files) await addShopBillPhoto(client, billId, await uploadBill(client, order, file), user.id);
    refresh([order]);
    return { ok: true };
  } catch (error) {
    if (errorMessage(error) === 'bill_type') return { ok: false, error: 'A bill must be a photo (JPEG, PNG, WebP, HEIC) or a PDF.' };
    if (errorMessage(error) === 'bill_size') return { ok: false, error: 'Each file must be 8 MB or smaller.' };
    return fail('shop_bill_photo', error);
  }
}

export async function removeShopBillPhotoAction(orderId: string, photoId: string): Promise<ActionResult> {
  const { client } = await requireAdminAction();
  try {
    const path = await removeShopBillPhoto(client, id.parse(photoId));
    if (path) await client.storage.from('vendor-docs').remove([path]);
    refresh([id.parse(orderId)]);
    return { ok: true };
  } catch (error) {
    return fail('shop_bill_photo_remove', error);
  }
}

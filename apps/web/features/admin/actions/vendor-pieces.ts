'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { approveSubmission, declineSubmission, getVendorSubmission, requestRetake, rerunPhotoJob, setProductStatus } from '@repo/db/admin';
import { listingSlug, PHOTO_CACHE_CONTROL } from '@repo/shared/domain';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

import type { IwcClient } from '@repo/db';

const approveSchema = z.object({
  name: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(300).optional(),
  fibre: z.string().trim().min(2).max(200),
  care: z.string().trim().min(2).max(300),
  /** Dollars as typed; empty = priced from the shop price (D-075). */
  price: z.string().trim().regex(/^(\d+(\.\d{1,2})?)?$/),
  front: z.string().min(1),
  back: z.string().optional(),
  publish: z.enum(['draft', 'live']),
});

/** Copies a picked photo into product-media under a new random path (PR-6: never overwritten, cached a year). */
async function copyToStore(client: IwcClient, bucket: 'photo-candidates' | 'vendor-uploads', path: string, folder: string): Promise<string> {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`could not read ${path}`);
  const target = `products/${folder}/${crypto.randomUUID()}.jpg`;
  const { error: upError } = await client.storage
    .from('product-media')
    .upload(target, data, { contentType: 'image/jpeg', cacheControl: PHOTO_CACHE_CONTROL });
  if (upError) throw new Error(upError.message);
  return target;
}

/**
 * Approves a vendor's piece (D-103): the picked AI photos (front, back) and the vendor's real close-up (D-100) go to
 * product-media, the piece becomes a product through admin_create_listing, optionally live at once; then the
 * candidates and the vendor's raw photos are deleted (they are copied; storage stays small).
 */
export async function approveVendorPieceAction(submissionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = approveSchema.parse(Object.fromEntries(form));
  const piece = await getVendorSubmission(client, submissionId);
  if (!piece) throw new Error('piece not found');
  const jobs = piece.jobs ?? [];
  const candidates = new Set(jobs.flatMap((j) => j.candidates ?? []));
  for (const pick of [input.front, input.back].filter((p): p is string => Boolean(p))) {
    if (!candidates.has(pick)) throw new Error('pick a photo made for this piece');
  }
  const closeup = piece.photos?.find((p) => p.view === 'closeup')?.storage_path;
  const folder = crypto.randomUUID();

  const media: { path: string; alt_text: string; is_ai: boolean }[] = [];
  media.push({ path: await copyToStore(client, 'photo-candidates', input.front, folder), alt_text: `${input.name}, front`, is_ai: true });
  if (input.back) media.push({ path: await copyToStore(client, 'photo-candidates', input.back, folder), alt_text: `${input.name}, back`, is_ai: true });
  if (closeup) media.push({ path: await copyToStore(client, 'vendor-uploads', closeup, folder), alt_text: `${input.name}, close-up of the fabric`, is_ai: false });

  const variants = (piece.variants as { label: string; qty: number }[]).map((v) => ({ label: v.label, qty: v.qty, options: { size: v.label } }));
  const productId = await approveSubmission(
    client,
    submissionId,
    {
      name: input.name,
      slug: listingSlug(input.name, submissionId.slice(0, 6)),
      summary: input.summary,
      attributes: { fibre_content: input.fibre, care: input.care },
      price_cents: input.price ? Math.round(Number(input.price) * 100) : undefined,
      variants,
    },
    media,
  );
  if (input.publish === 'live') {
    await setProductStatus(client, productId, 'live');
    revalidateTag(STORE_TAG);
  }

  // Copied above: the originals are no longer needed (D-103, storage kept small).
  await client.storage.from('photo-candidates').remove([...candidates]);
  const raw = (piece.photos ?? []).map((p) => p.storage_path);
  if (raw.length > 0) await client.storage.from('vendor-uploads').remove(raw);

  revalidatePath('/admin/vendor-pieces');
  revalidatePath('/admin/listings');
  redirect('/admin/vendor-pieces');
}

const REASONS = ['blurry', 'dark', 'background', 'not_whole', 'wrong_piece', 'other'] as const;

export async function retakeVendorPieceAction(submissionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const reason = z.enum(REASONS).parse(form.get('reason'));
  const note = z.string().trim().max(500).optional().parse(form.get('note') || undefined);
  await requestRetake(client, submissionId, reason, note);
  revalidatePath('/admin/vendor-pieces');
  redirect('/admin/vendor-pieces');
}

export async function declineVendorPieceAction(submissionId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const note = z.string().trim().max(500).optional().parse(form.get('note') || undefined);
  await declineSubmission(client, submissionId, note);
  revalidatePath('/admin/vendor-pieces');
  redirect('/admin/vendor-pieces');
}

/** Make a view's photos again, on another house model when one is picked. */
export async function rerunPhotoJobAction(submissionId: string, jobId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const model = z.string().uuid().optional().parse(form.get('house_model') || undefined);
  await rerunPhotoJob(client, z.string().uuid().parse(jobId), model);
  revalidatePath(`/admin/vendor-pieces/${submissionId}`);
}

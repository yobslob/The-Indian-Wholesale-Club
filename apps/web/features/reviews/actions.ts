'use server';

import { z } from 'zod';

import { addReviewPhoto, createReview, getMyProfile, getReviewableProduct, getReviewEligibility } from '@repo/db/account';

import { currentUser, sessionClient } from '@/lib/supabase/server';

import { MAX_REVIEW_PHOTOS } from './limits';

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const productIdSchema = z.string().uuid();

export interface ReviewPiece {
  id: string;
  name: string;
  slug: string;
  region_slug: string;
  region_name: string;
  category_name: string;
  primary_image_path: string | null;
}

export type ReviewFormState =
  | { signedIn: false }
  | { signedIn: true; piece: ReviewPiece; verified: boolean; reviewed: boolean; displayName: string }
  | { signedIn: true; piece: null };

/**
 * What the review form needs (D-090), read with the customer's own session: signed in or not, the piece (photo, name,
 * category · state), whether they may add photos (a verified buyer) or already reviewed it, and a first-name default.
 * The review panel calls it when it opens, so the product page itself stays static (PR-1).
 */
export async function reviewFormStateAction(productId: string): Promise<ReviewFormState> {
  const id = productIdSchema.parse(productId);
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) return { signedIn: false };
  const [piece, eligibility, profile] = await Promise.all([
    getReviewableProduct(client, id),
    getReviewEligibility(client, id),
    getMyProfile(client, user.id),
  ]);
  if (!piece) return { signedIn: true, piece: null };
  return {
    signedIn: true,
    piece: piece as ReviewPiece,
    verified: eligibility.is_verified_buyer,
    reviewed: eligibility.has_reviewed,
    displayName: profile?.full_name?.split(' ')[0] ?? '',
  };
}

/**
 * A customer's review (D-051, D-056): rating + text for every signed-in customer, photos only for verified buyers. The
 * database makes it pending (an admin checks it, D-052) and decides "verified"; photos from anyone else are refused
 * there too. Photos go to review-media/<user>/<review>/ with the customer's own session. Answers with the outcome, so
 * the panel and the page show the thank-you where the form was.
 */
export type ReviewResult = { ok: true; note?: string } | { error: string };

export async function submitReviewAction(productId: string, form: FormData): Promise<ReviewResult> {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) return { error: 'Please sign in again to send your review.' };
  const parsed = z
    .object({
      productId: productIdSchema,
      rating: z.coerce.number().int().min(1, 'Choose a rating.').max(5),
      body: z.string().trim().min(1, 'Write a few words.').max(2000),
      displayName: z.string().trim().min(1, 'Add the name to show.').max(60),
    })
    .safeParse({ productId, rating: form.get('rating') ?? 0, body: form.get('body'), displayName: form.get('displayName') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  const input = parsed.data;

  const photos = form
    .getAll('photos')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_REVIEW_PHOTOS);
  for (const file of photos) {
    if (!IMAGE_TYPES[file.type]) return { error: 'Photos must be JPEG, PNG or WebP images.' };
    if (file.size > MAX_PHOTO_BYTES) return { error: 'Each photo must be 8 MB or smaller.' };
  }

  let review: { id: string; is_verified_buyer: boolean };
  try {
    review = await createReview(client, {
      productId: input.productId,
      userId: user.id,
      rating: input.rating,
      body: input.body,
      displayName: input.displayName,
    });
  } catch {
    return { error: 'We could not save your review. If you already reviewed this piece, that one counts.' };
  }
  if (review.is_verified_buyer) {
    for (const [i, file] of photos.entries()) {
      const storagePath = `${user.id}/${review.id}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
      const { error } = await client.storage.from('review-media').upload(storagePath, file, { contentType: file.type });
      if (error) return { ok: true, note: 'Your review is in, but a photo did not upload.' };
      await addReviewPhoto(client, review.id, storagePath, i);
    }
  }
  return { ok: true };
}

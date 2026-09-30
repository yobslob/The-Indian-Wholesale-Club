'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { addReviewPhoto, createReview } from '@repo/db/account';

import { requireCustomer } from '@/features/account/session';

import { MAX_REVIEW_PHOTOS } from './limits';

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * A customer's review (D-051, D-056): rating + text for every signed-in customer, photos only for verified
 * buyers. The database makes it pending (an admin checks it, D-052) and decides "verified"; photos from anyone
 * else are refused there too. Photos go to review-media/<user>/<review>/ with the customer's own session.
 */
export async function submitReviewAction(productId: string, form: FormData): Promise<void> {
  const path = `/account/reviews/${productId}`;
  const { client, user } = await requireCustomer(path);
  const input = z
    .object({
      productId: z.string().uuid(),
      rating: z.coerce.number().int().min(1).max(5),
      body: z.string().trim().min(1, 'write a few words').max(2000),
      displayName: z.string().trim().min(1, 'add the name to show').max(60),
    })
    .parse({ productId, rating: form.get('rating'), body: form.get('body'), displayName: form.get('displayName') });

  const review = await createReview(client, {
    productId: input.productId,
    userId: user.id,
    rating: input.rating,
    body: input.body,
    displayName: input.displayName,
  });

  const photos = form
    .getAll('photos')
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_REVIEW_PHOTOS);
  if (review.is_verified_buyer) {
    for (const [i, file] of photos.entries()) {
      const ext = IMAGE_TYPES[file.type];
      if (!ext) throw new Error('photos must be JPEG, PNG or WebP images');
      if (file.size > MAX_PHOTO_BYTES) throw new Error('each photo must be 8 MB or smaller');
      const storagePath = `${user.id}/${review.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await client.storage.from('review-media').upload(storagePath, file, { contentType: file.type });
      if (error) throw new Error(`photo upload failed: ${error.message}`);
      await addReviewPhoto(client, review.id, storagePath, i);
    }
  }
  redirect(`${path}?sent=1`);
}

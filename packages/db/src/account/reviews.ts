/**
 * The signed-in customer's own reviews (D-051, D-056). RLS lets a customer insert and read only their own;
 * the database sets status (always pending) and "verified buyer" (a delivered order with the product).
 */
import { z } from 'zod';

import { unwrap, type IwcClient } from '../client';

export const reviewEligibilitySchema = z.object({
  is_verified_buyer: z.boolean(),
  has_reviewed: z.boolean(),
});
export type ReviewEligibility = z.infer<typeof reviewEligibilitySchema>;

/** Whether the signed-in customer may add photos (verified buyer) and whether they already reviewed. */
export async function getReviewEligibility(client: IwcClient, productId: string): Promise<ReviewEligibility> {
  const data = unwrap(await client.rpc('review_eligibility', { p_product: productId }, { get: true }));
  return reviewEligibilitySchema.parse(data);
}

/** The product a review form is about, from the store view (live products only). */
export async function getReviewableProduct(client: IwcClient, productId: string) {
  return unwrap(
    await client
      .from('store_products')
      .select('id, name, slug, region_slug, region_name')
      .eq('id', productId)
      .maybeSingle(),
  );
}

/** A new review (pending until an admin approves it). Returns its id and whether it counts as verified. */
export async function createReview(
  client: IwcClient,
  input: { productId: string; userId: string; rating: number; body: string; displayName: string },
): Promise<{ id: string; is_verified_buyer: boolean }> {
  return unwrap(
    await client
      .from('reviews')
      .insert({
        product_id: input.productId,
        user_id: input.userId,
        rating: input.rating,
        body: input.body,
        display_name: input.displayName,
      })
      .select('id, is_verified_buyer')
      .single(),
  );
}

/** Links an uploaded photo to the customer's review. The database refuses it unless the review is verified. */
export async function addReviewPhoto(client: IwcClient, reviewId: string, storagePath: string, sortOrder: number) {
  unwrap(
    await client.from('review_photos').insert({ review_id: reviewId, storage_path: storagePath, sort_order: sortOrder }),
  );
}

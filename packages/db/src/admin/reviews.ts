import { unwrap, unwrapPage, type IwcClient } from '../client';

/** A page of reviews in one state (pending: oldest first), with the product and any photos, and how many in all. */
export async function listReviewsForModeration(
  client: IwcClient,
  status: 'pending' | 'approved' | 'rejected' = 'pending',
  offset = 0,
  limit = 50,
) {
  return unwrapPage(
    await client
      .from('reviews')
      .select(
        `id, rating, body, display_name, is_verified_buyer, status, created_at, moderated_at,
          product:products(id, name, slug, region:regions(slug, name)),
          photos:review_photos(id, storage_path, sort_order)`,
        { count: 'exact' },
      )
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .order('id')
      .range(offset, offset + limit - 1),
  );
}

/** Approve or reject a review. Only admins can (RLS admin_all); customers cannot change their own. */
export async function setReviewStatus(
  client: IwcClient,
  reviewId: string,
  status: 'approved' | 'rejected',
  adminId: string,
) {
  unwrap(
    await client
      .from('reviews')
      .update({ status, moderated_at: new Date().toISOString(), moderated_by: adminId })
      .eq('id', reviewId),
  );
}

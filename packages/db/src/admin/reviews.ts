import { unwrap, type IwcClient } from '../client';

/** Reviews waiting for a decision (D-052), oldest first, with the product and any photos. */
export async function listReviewsForModeration(client: IwcClient, status: 'pending' | 'approved' | 'rejected' = 'pending') {
  return unwrap(
    await client
      .from('reviews')
      .select(
        `id, rating, body, display_name, is_verified_buyer, status, created_at, moderated_at,
          product:products(id, name, slug, region:regions(slug, name)),
          photos:review_photos(id, storage_path, sort_order)`,
      )
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .limit(100),
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

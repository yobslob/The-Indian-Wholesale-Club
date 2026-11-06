'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { setReviewStatus } from '@repo/db/admin';

import { requireAdminAction } from '../guard';
import { refreshProductPages } from '../refresh-listings';

/** Approve or reject a customer's review (D-052). Approved reviews show on the product page. */
export async function moderateReviewAction(reviewId: string, status: 'approved' | 'rejected'): Promise<void> {
  const { client, user } = await requireAdminAction();
  const productId = await setReviewStatus(
    client,
    z.string().uuid().parse(reviewId),
    z.enum(['approved', 'rejected']).parse(status),
    user.id,
  );
  await refreshProductPages(client, [productId]);
  revalidatePath('/admin/reviews');
}

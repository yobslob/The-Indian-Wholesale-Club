'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { setReviewStatus } from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

/** Approve or reject a customer's review (D-052). Approved reviews show on the product page. */
export async function moderateReviewAction(reviewId: string, status: 'approved' | 'rejected'): Promise<void> {
  const { client, user } = await requireAdminAction();
  await setReviewStatus(
    client,
    z.string().uuid().parse(reviewId),
    z.enum(['approved', 'rejected']).parse(status),
    user.id,
  );
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/reviews');
}

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { archiveListings, moveListings } from '@repo/db/admin';

import { errorMessage, logger } from '@/lib/logger';

import { requireAdminAction } from '../guard';
import { refreshListings } from '../refresh-listings';

const id = z.string().uuid();
type Result = { ok: true; done: number } | { ok: false; error: string };

/** Categories to check: the ticked listings to the category chosen for each (their own type's, by the page). */
export async function moveListingsAction(moves: { id: string; categoryId: string }[]): Promise<Result> {
  const { client } = await requireAdminAction();
  try {
    const list = z.array(z.object({ id, categoryId: id })).max(1000).parse(moves);
    const done = await moveListings(client, list);
    await refreshListings(client, list.map((m) => m.id));
    revalidatePath('/admin/catalog/categories');
    return { ok: true, done };
  } catch (error) {
    logger.error('admin.move_listings_failed', { error: errorMessage(error) });
    return { ok: false, error: 'The moves did not save. Try again.' };
  }
}

/** Categories to check: the ticked listings that are not their type at all, archived (an admin can bring one back). */
export async function archiveListingsAction(ids: string[]): Promise<Result> {
  const { client } = await requireAdminAction();
  try {
    const list = z.array(id).max(1000).parse(ids);
    // their pages first: once archived, an unseen listing refreshes nothing
    await refreshListings(client, list, true);
    const done = await archiveListings(client, list);
    revalidatePath('/admin/catalog/categories');
    return { ok: true, done };
  } catch (error) {
    logger.error('admin.archive_listings_failed', { error: errorMessage(error) });
    return { ok: false, error: 'They were not archived. Try again.' };
  }
}

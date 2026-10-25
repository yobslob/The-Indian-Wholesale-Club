'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { addSearchSynonym } from '@repo/db/admin';

import { errorMessage, logger } from '@/lib/logger';

import { requireAdminAction } from '../guard';

const word = z.string().regex(/^[a-z]{2,30}$/);

/**
 * Insights' "Add as a synonym" (D-160): the customer's word ("kurtha") joins the word search read it as ("kurta"), so
 * the next search finds it as a whole word and the suggestions know it. Search pages are not cached: nothing to refresh
 * but Insights itself.
 */
export async function addSynonymAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const term = word.safeParse(form.get('term'));
  const means = word.safeParse(form.get('means'));
  if (!term.success || !means.success) return;
  try {
    await addSearchSynonym(client, term.data, means.data);
  } catch (error) {
    logger.error('admin.add_synonym_failed', { error: errorMessage(error) });
  }
  revalidatePath('/admin/insights');
}

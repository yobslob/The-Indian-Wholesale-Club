'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

import {
  acceptWeights,
  archiveUnreadyDrafts,
  assignWeights,
  listNamesToReview,
  publishDrafts,
  renameListings,
  weightPlan,
  type ArchiveResult,
  type AssignResult,
  type PublishDraftsResult,
} from '@repo/db/admin';
import { assignWeights as ruleWeights, weightPlanSchema } from '@repo/shared/sourcing/estimate';

import { STORE_TAG } from '@/features/catalog/data';
import { errorMessage, logger } from '@/lib/logger';

import { requireAdminAction } from '../guard';
import { nameProposals } from '../names/proposals';

/**
 * D-146: one press clears Weights to check, Drafts and Names to tidy. Each action is one batch, well inside the
 * database's statement time limit and Vercel's function time; the button calls it again until nothing is left, then
 * `finishBulkAction` refreshes the store once (one whole-store refresh, not one per batch: D-145).
 */

const ASSIGN_MOST = 600;

type Step<T> ={ ok: true; value: T } | { ok: false; error: string };

async function step<T>(name: string, run: () => Promise<T>): Promise<Step<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    logger.error(`admin.bulk_${name}_failed`, { error: errorMessage(error) });
    return { ok: false, error: 'That step did not finish. Press the button again: it carries on where it stopped.' };
  }
}

/** Up to 40 listings: the house rules' weights, then similar pieces' for the rest. `left` = listings still waiting. */
export async function assignWeightsStepAction(): Promise<Step<AssignResult & { listings: number; left: number }>> {
  const { client } = await requireAdminAction();
  return step('assign', async () => {
    const plan = weightPlanSchema.parse(await weightPlan(client, 40));
    if (plan.rows.length === 0) return { ruled: 0, similar: 0, usual: 0, listings: 0, left: 0 };
    // admin_assign_weights takes up to 600 options a call: 40 of Savana's pieces, a colour by a size each, came to
    // more and every press failed (2026-10-31), so the options go in calls of 600
    const items = ruleWeights(plan.rows);
    const result: AssignResult = { ruled: 0, similar: 0, usual: 0 };
    for (let i = 0; i < items.length; i += ASSIGN_MOST) {
      const r = await assignWeights(client, items.slice(i, i + ASSIGN_MOST));
      result.ruled += r.ruled;
      result.similar += r.similar;
      result.usual += r.usual;
    }
    return { ...result, listings: plan.rows.length, left: Math.max(plan.left - plan.rows.length, 0) };
  });
}

/** Up to 2,000 options: the weights Weights to check showed are accepted. */
export async function acceptWeightsStepAction(): Promise<Step<number>> {
  const { client } = await requireAdminAction();
  return step('accept', () => acceptWeights(client, 2000));
}

/** Up to 400 ready drafts go live; the result says what holds the others and how many ready ones are left. */
export async function publishStepAction(): Promise<Step<PublishDraftsResult>> {
  const { client } = await requireAdminAction();
  return step('publish', () => publishDrafts(client, 400));
}

/** Up to 250 of Names to tidy's proposals, as proposed; `left` = proposals still waiting. */
export async function renameAllStepAction(): Promise<Step<{ renamed: number; left: number }>> {
  const { client } = await requireAdminAction();
  return step('rename', async () => {
    const proposals = nameProposals(await listNamesToReview(client));
    const batch = proposals.slice(0, 250);
    const renamed = await renameListings(client, batch.map((p) => ({ id: p.id, name: p.to })));
    return { renamed, left: proposals.length - batch.length };
  });
}

/** Drafts that cannot go live are archived, so Drafts holds only the next batch. */
export async function archiveUnreadyAction(): Promise<Step<ArchiveResult>> {
  const { client } = await requireAdminAction();
  const result = await step('archive', () => archiveUnreadyDrafts(client));
  revalidatePath('/admin/catalog');
  return result;
}

/** After the batches: the store once, and the admin lists. */
export async function finishBulkAction(): Promise<void> {
  await requireAdminAction();
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/catalog');
  revalidatePath('/admin/catalog/names');
  revalidatePath('/admin/listings');
}

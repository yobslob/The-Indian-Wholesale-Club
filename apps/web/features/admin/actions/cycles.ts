'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { advanceCycle, createCycle, cutoffCycle, markPickup, recordPayout } from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Dates are always entered by an admin (D-026). Cutoff is entered in UTC. */
export async function createCycleAction(form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      code: z.string().trim().min(2).max(40),
      cutoffAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
      estExportOn: isoDate.or(z.literal('')),
      estArrivalOn: isoDate,
    })
    .parse(Object.fromEntries(form));
  await createCycle(client, {
    code: input.code,
    status: 'open',
    cutoff_at: `${input.cutoffAt}:00Z`,
    est_export_on: input.estExportOn || null,
    est_arrival_on: input.estArrivalOn,
  });
  revalidateTag(STORE_TAG); // the storefront's delivery window comes from the open cycle (D-008)
  revalidatePath('/admin/cycles');
}

/** flows.md §4.1: close the cycle to orders and create the pickup checklist. */
export async function cutoffCycleAction(cycleId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await cutoffCycle(client, id.parse(cycleId));
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/cycles');
  revalidatePath(`/admin/cycles/${cycleId}`);
}

export async function advanceCycleAction(cycleId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await advanceCycle(client, id.parse(cycleId));
  revalidatePath('/admin/cycles');
  revalidatePath(`/admin/cycles/${cycleId}`);
}

/** flows.md §4.2–4: the COO marks a piece picked or unavailable at the shop. */
export async function markPickupAction(
  pickupId: string,
  status: 'picked' | 'unavailable',
  cycleId: string,
): Promise<void> {
  const { client } = await requireAdminAction();
  await markPickup(client, id.parse(pickupId), z.enum(['picked', 'unavailable']).parse(status));
  revalidateTag(STORE_TAG); // stock changed
  revalidatePath(`/admin/cycles/${cycleId}`);
}

/** flows.md §5: pays every picked, unpaid piece of one vendor; the amount is computed in SQL. */
export async function recordPayoutAction(
  vendorId: string,
  pickupIds: string[],
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ method: z.string().trim().min(2).max(40), reference: z.string().trim().max(120) })
    .parse({ method: form.get('method'), reference: form.get('reference') ?? '' });
  await recordPayout(client, {
    vendorId: id.parse(vendorId),
    pickupIds: z.array(id).min(1).parse(pickupIds),
    method: input.method,
    reference: input.reference || undefined,
  });
  revalidatePath('/admin/payouts');
}

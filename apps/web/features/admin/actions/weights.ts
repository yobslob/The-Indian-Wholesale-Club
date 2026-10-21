'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import { setVariantWeight, weighPickup } from '@repo/db/admin';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';
import { gramsFrom } from '../hub-grams';
import { refreshListings } from '../refresh-listings';

const id = z.string().uuid();
const weightForm = z.object({
  grams: z.coerce.number().int('Whole grams.').min(1, 'At least 1 g.').max(50_000, 'At most 50 kg.'),
  /** Ticked: put on a scale with the piece in hand; else typed (D-129). */
  weighed: z.literal('on').optional(),
  note: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v || null),
});

function read(form: FormData) {
  return weightForm.parse({
    grams: form.get('grams'),
    weighed: form.get('weighed') ?? undefined,
    note: form.get('note') ?? '',
  });
}

async function done(client: Parameters<typeof refreshListings>[0], productId: string): Promise<void> {
  await refreshListings(client, [productId]);
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath('/admin/catalog');
}

/** D-130: a picked piece weighed at the hub; its option takes the weight and the listing is repriced. */
export async function weighPickupAction(pickupId: string, path: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const grams = gramsFrom(form);
  if (grams === null) return;
  await weighPickup(client, id.parse(pickupId), grams);
  revalidateTag(STORE_TAG);
  revalidatePath(z.string().startsWith('/admin/').parse(path));
}

/** One option's weight (D-129): the database reprices the listing from it (D-128). */
export async function setWeightAction(
  productId: string,
  variantId: string,
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const input = read(form);
  await setVariantWeight(client, id.parse(variantId), {
    grams: input.grams,
    source: input.weighed ? 'weighed' : 'admin',
    note: input.note,
  });
  await done(client, id.parse(productId));
}

/**
 * The same weight for every size and colour of one piece (not packs: a 1 kg pack is not a 200 g one), so a garment
 * weighed once fixes all its options.
 */
export async function setWeightForSizesAction(
  productId: string,
  variantIds: string[],
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const input = read(form);
  for (const v of z.array(id).max(60).parse(variantIds)) {
    await setVariantWeight(client, v, {
      grams: input.grams,
      source: input.weighed ? 'weighed' : 'admin',
      note: input.note,
    });
  }
  await done(client, id.parse(productId));
}

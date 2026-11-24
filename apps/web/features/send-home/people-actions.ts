'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { archiveLovedOne, saveLovedOne, setSendHomeInBag } from '@repo/db/account';
import { giftLineOf, RELATIONS, upiOf } from '@repo/shared/domain';

import { customerOrNull } from '@/features/account/session';

import { SEND_HOME_WORDS } from './words';

export type PeopleState = { error: string | null; done?: boolean };

const personSchema = z.object({
  relation: z.enum(RELATIONS),
  callName: z.string().trim().min(1).max(20),
  upi: z.string().trim().max(80),
  regionId: z.union([z.literal(''), z.string().uuid()]),
  note: z.string().max(60),
});

/** D-205: add or edit one of the customer's people at home (their own rows only, RLS). */
export async function saveLovedOneAction(id: string | null, _prev: PeopleState, form: FormData): Promise<PeopleState> {
  const me = await customerOrNull();
  if (!me) return { error: 'Please sign in again.' };
  const parsed = personSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: SEND_HOME_WORDS.people.formBad };
  // editing with the UPI field left empty keeps the one saved
  const keep = Boolean(id) && parsed.data.upi === '';
  const upi = keep ? null : upiOf(parsed.data.upi);
  if (!keep && !upi) return { error: SEND_HOME_WORDS.upiCheck.bad };
  try {
    await saveLovedOne(me.client, me.user.id, id ? z.string().uuid().parse(id) : null, {
      relation: parsed.data.relation,
      callName: parsed.data.callName,
      upi: upi?.value ?? null,
      regionId: parsed.data.regionId || null,
      note: giftLineOf(parsed.data.note),
    });
  } catch {
    return { error: SEND_HOME_WORDS.people.saveFailed };
  }
  revalidatePath('/account/people');
  return { error: null, done: true };
}

export async function removeLovedOneAction(id: string): Promise<void> {
  const me = await customerOrNull();
  if (!me) return;
  await archiveLovedOne(me.client, me.user.id, z.string().uuid().parse(id));
  revalidatePath('/account/people');
}

/** D-205 §4.7: off = the bag's Send home card starts removed. */
export async function setInBagAction(form: FormData): Promise<void> {
  const me = await customerOrNull();
  if (!me) return;
  await setSendHomeInBag(me.client, me.user.id, form.get('on') === '1');
  revalidatePath('/account/people');
}

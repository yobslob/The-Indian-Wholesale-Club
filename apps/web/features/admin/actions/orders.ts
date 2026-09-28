'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addOrderEvent,
  changeDeliveryWindow,
  markOrderDelivered,
  markOrderShipped,
} from '@repo/db/admin';

import { requireAdminAction } from '../guard';

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done(orderId: string): void {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}

/** US desk: the order leaves in a domestic parcel (flows.md §6.4). Carrier typed by hand until Q-3. */
export async function markShippedAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      carrier: z.string().trim().min(2).max(40),
      tracking: z.string().trim().min(4).max(60),
    })
    .parse({ carrier: form.get('carrier'), tracking: form.get('tracking') });
  await markOrderShipped(client, id.parse(orderId), input.carrier, input.tracking);
  done(orderId);
}

export async function markDeliveredAction(orderId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await markOrderDelivered(client, id.parse(orderId));
  done(orderId);
}

/** D-008 / INV-6: the only way to move a promised window; the customer sees the new estimate. */
export async function changeWindowAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ from: isoDate, to: isoDate, note: z.string().trim().max(500) })
    .parse({ from: form.get('from'), to: form.get('to'), note: form.get('note') ?? '' });
  await changeDeliveryWindow(client, {
    orderId: id.parse(orderId),
    from: input.from,
    to: input.to,
    note: input.note || undefined,
  });
  done(orderId);
}

/** Internal note (never shown to the customer, D-003). */
export async function addNoteAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const note = z.string().trim().min(1).max(1000).parse(form.get('note'));
  await addOrderEvent(client, {
    orderId: id.parse(orderId),
    kind: 'note',
    visibleToCustomer: false,
    internalNote: note,
  });
  done(orderId);
}

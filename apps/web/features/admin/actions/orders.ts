'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addOrderEvent,
  changeDeliveryWindow,
  markOrderDelivered,
  markOrderShipped,
  markPickup,
  moveOrder,
} from '@repo/db/admin';

import { sendEmailsSoon } from '../emails-soon';
import { requireAdminAction } from '../guard';

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done(orderId: string): void {
  sendEmailsSoon();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
}

/**
 * US desk: the order leaves in a domestic parcel (flows.md §6.4). The carrier is picked (USPS, UPS, FedEx get a
 * tracking link, D-066) or typed as "Other" while Q-3 is open.
 */
export async function markShippedAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      carrier: z.string().trim().min(2).max(40),
      otherCarrier: z.string().trim().max(40),
      tracking: z.string().trim().min(4).max(60),
    })
    .parse({
      carrier: form.get('carrier'),
      otherCarrier: form.get('otherCarrier') ?? '',
      tracking: form.get('tracking'),
    });
  const carrier = input.carrier === 'Other' ? z.string().min(2).parse(input.otherCarrier) : input.carrier;
  await markOrderShipped(client, id.parse(orderId), carrier, input.tracking);
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

/** flows.md §6b / D-045: the order joins another cycle, as it did physically. A later cycle changes its window. */
export async function moveOrderAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ toCycleId: id, note: z.string().trim().max(500) })
    .parse({ toCycleId: form.get('toCycleId'), note: form.get('note') ?? '' });
  await moveOrder(client, { orderId: id.parse(orderId), toCycleId: input.toCycleId, note: input.note || undefined });
  done(orderId);
  revalidatePath('/admin/cycles', 'layout');
}

/** D-070: the COO marks an express order's piece picked (or unavailable) at the shop; then it goes by courier. */
export async function markExpressPickupAction(
  pickupId: string,
  status: 'picked' | 'unavailable',
  orderId: string,
): Promise<void> {
  const { client } = await requireAdminAction();
  await markPickup(client, id.parse(pickupId), z.enum(['picked', 'unavailable']).parse(status));
  done(orderId);
}

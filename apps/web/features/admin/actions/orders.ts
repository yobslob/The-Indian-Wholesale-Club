'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  addOrderEvent,
  changeDeliveryWindow,
  changeShipmentWindow,
  deliverShipment,
  markOrderDelivered,
  markOrderShipped,
  markPickup,
  moveOrder,
  shipShipment,
  weighPickup,
} from '@repo/db/admin';

import { sendEmailsSoon } from '../emails-soon';
import { requireAdminAction } from '../guard';
import { gramsFrom } from '../hub-grams';

const id = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function done(orderId: string): void {
  sendEmailsSoon();
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  // D-140: the India desk's pipeline (to order, ordered, at the hub)
  revalidatePath('/admin/to-order');
}

/** The carrier picked (USPS, UPS, FedEx get a tracking link, D-066) or typed as "Other" while Q-3 is open. */
function carrierFrom(form: FormData): { carrier: string; tracking: string } {
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
  return { carrier, tracking: input.tracking };
}

/** US desk: the order leaves in a domestic parcel (flows.md §6.4). */
export async function markShippedAction(orderId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const { carrier, tracking } = carrierFrom(form);
  await markOrderShipped(client, id.parse(orderId), carrier, tracking);
  done(orderId);
}

export async function markDeliveredAction(orderId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await markOrderDelivered(client, id.parse(orderId));
  done(orderId);
}

/** D-154: one of an order's two shipments leaves, with its own tracking number and email. */
export async function markShipmentShippedAction(orderId: string, shipmentId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const { carrier, tracking } = carrierFrom(form);
  await shipShipment(client, id.parse(shipmentId), carrier, tracking);
  done(orderId);
}

export async function markShipmentDeliveredAction(orderId: string, shipmentId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await deliverShipment(client, id.parse(shipmentId));
  done(orderId);
}

/** D-008 for one shipment (D-154): the customer may keep it with the new dates or cancel that shipment. */
export async function changeShipmentWindowAction(orderId: string, shipmentId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ from: isoDate, to: isoDate, note: z.string().trim().max(500) })
    .parse({ from: form.get('from'), to: form.get('to'), note: form.get('note') ?? '' });
  await changeShipmentWindow(client, { shipmentId: id.parse(shipmentId), from: input.from, to: input.to, note: input.note || undefined });
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
  form?: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  await markPickup(client, id.parse(pickupId), z.enum(['picked', 'unavailable']).parse(status));
  // D-130: weighed as it is picked, when the desk typed a weight
  const grams = status === 'picked' ? gramsFrom(form) : null;
  if (grams !== null) await weighPickup(client, pickupId, grams);
  done(orderId);
}

export interface BulkResult {
  done: number;
  failed: { id: string; error: string }[];
}

/** Each order on its own: one that fails (wrong status, a typo) doesn't stop the rest; the admin sees which. */
async function eachOrder(ids: string[], run: (id: string) => Promise<void>): Promise<BulkResult> {
  const result: BulkResult = { done: 0, failed: [] };
  for (const orderId of ids) {
    try {
      await run(orderId);
      result.done += 1;
    } catch (error) {
      result.failed.push({ id: orderId, error: error instanceof Error ? error.message : 'failed' });
    }
  }
  sendEmailsSoon();
  revalidatePath('/admin/orders', 'layout');
  return result;
}

/** D-096: Mark shipped for several orders at once, one carrier and tracking number each (D-066). */
export async function bulkShipAction(lines: { orderId: string; carrier: string; tracking: string }[]): Promise<BulkResult> {
  const { client } = await requireAdminAction();
  const parsed = z
    .array(z.object({ orderId: id, carrier: z.string().trim().min(2).max(40), tracking: z.string().trim().min(4).max(60) }))
    .min(1)
    .max(50)
    .parse(lines);
  const byId = new Map(parsed.map((l) => [l.orderId, l]));
  return eachOrder([...byId.keys()], async (orderId) => {
    const line = byId.get(orderId)!;
    await markOrderShipped(client, orderId, line.carrier, line.tracking);
  });
}

/** D-096: Mark delivered for several shipped orders at once. */
export async function bulkDeliveredAction(orderIds: string[]): Promise<BulkResult> {
  const { client } = await requireAdminAction();
  return eachOrder(z.array(id).min(1).max(50).parse(orderIds), (orderId) => markOrderDelivered(client, orderId));
}

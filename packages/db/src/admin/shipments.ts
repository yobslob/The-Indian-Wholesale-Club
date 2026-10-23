/**
 * D-154: an order's one or two shipments, run one at a time (migration 20261024090000). Each ships with its carrier
 * and tracking number, is delivered, gets its own new dates (the delay notice, D-008) and can be cancelled on its own;
 * the order follows them. Amounts are computed in SQL and checked again when recorded; Stripe is refunded first.
 */
import { z } from 'zod';

import { DbError, unwrap, type IwcClient } from '../client';

import type { CancelReason } from './refunds';

export async function shipShipment(
  client: IwcClient,
  shipmentId: string,
  carrier: string,
  trackingNumber: string,
) {
  unwrap(
    await client.rpc('ship_shipment', {
      p_shipment: shipmentId,
      p_carrier: carrier,
      p_tracking: trackingNumber,
    }),
  );
}

export async function deliverShipment(client: IwcClient, shipmentId: string) {
  unwrap(await client.rpc('deliver_shipment', { p_shipment: shipmentId }));
}

/** D-008 for one shipment: the customer sees the new dates and may keep it or cancel that shipment. */
export async function changeShipmentWindow(
  client: IwcClient,
  input: { shipmentId: string; from: string; to: string; note?: string },
) {
  unwrap(
    await client.rpc('change_shipment_window', {
      p_shipment: input.shipmentId,
      p_from: input.from,
      p_to: input.to,
      ...(input.note ? { p_note: input.note } : {}),
    }),
  );
}

/** Its pieces, its Shipping share and their tax back (less the cancel fee for the customer's own once at the hub); null when it can't be cancelled alone. */
export async function shipmentCancelCents(
  client: IwcClient,
  shipmentId: string,
  reason: CancelReason,
): Promise<number | null> {
  return unwrap(
    await client.rpc(
      'shipment_cancel_cents',
      { p_shipment: shipmentId, p_reason: reason },
      { get: true },
    ),
  );
}

export async function recordShipmentCancel(
  client: IwcClient,
  input: { shipmentId: string; reason: CancelReason; amountCents: number; refundRef: string },
) {
  unwrap(
    await client.rpc('admin_cancel_shipment', {
      p_shipment: input.shipmentId,
      p_reason: input.reason,
      p_amount_cents: input.amountCents,
      p_refund_ref: input.refundRef,
    }),
  );
}

const quickWatchSchema = z.object({
  open: z.number().int(),
  not_bought: z.number().int(),
  not_shipped: z.number().int(),
});
export type QuickWatch = z.infer<typeof quickWatchSchema>;

/** Today: 7-day shipments open, those not bought within 2 hours and those not shipped by the next day. */
export async function quickWatch(client: IwcClient): Promise<QuickWatch> {
  const data = unwrap(await client.rpc('admin_quick_watch', undefined, { get: true }));
  const parsed = quickWatchSchema.safeParse(data);
  if (!parsed.success) throw new DbError('quick_watch_shape', parsed.error.message);
  return parsed.data;
}

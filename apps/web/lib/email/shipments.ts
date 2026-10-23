import { formatDeliveryWindow, formatOrderBy } from '@repo/shared/domain';

import type { OrderDetail, OrderShipment } from '@repo/db/store';

/**
 * D-154: an order of two shipments (its 7-day pieces travel on their own) speaks of each: "Shipment 1 · Arrives by
 * Fri, Oct 30", "Shipment 2 · Arrives Nov 3 – Nov 7" (the plan's approved words). An order of one shipment is spoken
 * of as an order, as before.
 */
export function shipmentOf(order: OrderDetail, seq: number | null | undefined): OrderShipment | undefined {
  return order.shipments.length > 1 && seq ? order.shipments.find((s) => s.seq === seq) : undefined;
}

/** "Arrives by Fri, Oct 30" (one day), "Arrives Nov 3 – Nov 7"; null without dates. */
export function arrives(sh: Pick<OrderShipment, 'est_delivery_from' | 'est_delivery_to'>): string | null {
  const { est_delivery_from: from, est_delivery_to: to } = sh;
  if (!from || !to) return null;
  return from === to ? `Arrives by ${formatOrderBy(`${to}T12:00:00Z`, 'UTC')}` : `Arrives ${formatDeliveryWindow(from, to)}`;
}

export function piecesOf(order: OrderDetail, sh: OrderShipment): OrderDetail['items'] {
  const ids = new Set(sh.item_ids);
  return order.items.filter((i) => ids.has(i.id));
}

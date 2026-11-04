import { orderEventLabel } from '../domain/order-status';

/** Internal order events in plain words for the admin's timeline (D-096). Customer-visible ones read as the customer sees them. */
const INTERNAL: Record<string, string> = {
  note: 'Note',
  delay_kept: 'The customer kept the order with the new date',
  shop_ordered: 'Ordered from the shop',
  shop_bill_reopened: 'The shop bill was reopened',
};

export function adminEventText(e: { kind: string; visible_to_customer: boolean; message: string | null; internal_note: string | null }): {
  text: string;
  note: string | null;
} {
  const base = e.visible_to_customer
    ? orderEventLabel(e.kind)
    : (INTERNAL[e.kind] ?? e.kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
  return { text: e.message ? `${base} · ${e.message}` : base, note: e.internal_note };
}

export interface ShipCheck {
  status: string;
  items: { status: string; shipment_id?: string | null; pickup: { status: string } | null }[];
}

export interface ShipmentCheck {
  id: string;
  status: string;
}

const NOT_SHIPPED = ['confirmed', 'collecting', 'packed', 'in_transit', 'arrived'];

/**
 * What a shipment's main action is now (D-096, D-154, D-187), as ship_shipment checks it: every shipment leaves the
 * hub once its own pieces are there.
 */
export function shipmentShipState(order: ShipCheck, shipment: ShipmentCheck | null): { canShip: boolean; unpicked: number } {
  const items = order.items.filter((i) => !shipment || !i.shipment_id || i.shipment_id === shipment.id);
  const unpicked = items.filter((i) => i.status === 'active' && i.pickup?.status === 'pending').length;
  const open = !shipment || shipment.status === 'open';
  return { canShip: open && NOT_SHIPPED.includes(order.status) && unpicked === 0, unpicked };
}

/** The order as one shipment (the Orders list, an order of one shipment). */
export function shipState(order: ShipCheck): { canShip: boolean; unpicked: number } {
  return shipmentShipState(order, null);
}

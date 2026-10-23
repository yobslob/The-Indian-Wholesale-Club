import { orderEventLabel } from '../domain/order-status';

/** Internal order events in plain words for the admin's timeline (D-096). Customer-visible ones read as the customer sees them. */
const INTERNAL: Record<string, string> = {
  note: 'Note',
  delay_kept: 'The customer kept the order with the new date',
  moved_to_cycle: 'Moved to another cycle',
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
  shipping_method: string;
  cycle_id: string | null;
  items: { status: string; shipment_id?: string | null; pickup: { status: string; arrived_at: string | null } | null }[];
}

export interface ShipmentCheck {
  id: string;
  kind: string;
  status: string;
}

const IN_INDIA = ['confirmed', 'collecting', 'packed', 'in_transit', 'arrived'];

/**
 * What a shipment's main action is now (D-096, D-097; flows.md §6.4), as ship_shipment checks it: from the hub (a
 * 7-day shipment by courier, D-154; Express, D-070; any order without a cycle, the pilot, D-115) once every piece is
 * there; in a cycle once its export has arrived. `unchecked`: picked pieces not yet ticked off as arrived.
 */
export function shipmentShipState(
  order: ShipCheck,
  shipment: ShipmentCheck | null,
): { canShip: boolean; fromHub: boolean; express: boolean; unpicked: number; unchecked: number } {
  const express = order.shipping_method === 'express' && !order.cycle_id; // courier straight from India
  const fromHub = shipment?.kind === 'quick' || !order.cycle_id;
  const items = order.items.filter((i) => !shipment || !i.shipment_id || i.shipment_id === shipment.id);
  const unpicked = items.filter((i) => i.status === 'active' && i.pickup?.status === 'pending').length;
  const open = !shipment || shipment.status === 'open';
  const canShip = open && (fromHub ? IN_INDIA.includes(order.status) && unpicked === 0 : order.status === 'arrived');
  const unchecked = fromHub ? 0 : items.filter((i) => i.pickup?.status === 'picked' && !i.pickup.arrived_at).length;
  return { canShip, fromHub, express, unpicked, unchecked };
}

/** The order as one shipment (the Orders list, an order of one shipment). */
export function shipState(order: ShipCheck): { canShip: boolean; express: boolean; unpicked: number; unchecked: number } {
  const { canShip, express, unpicked, unchecked } = shipmentShipState(order, null);
  return { canShip, express, unpicked, unchecked };
}

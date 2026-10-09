import { orderEventLabel } from '../domain/order-status';

/** Internal order events in plain words for the admin's timeline (D-096). Customer-visible ones read as the customer sees them. */
const INTERNAL: Record<string, string> = {
  note: 'Note',
  delay_kept: 'The customer kept the order with the new date',
  moved_to_cycle: 'Moved to another cycle',
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
  items: { status: string; pickup: { status: string; arrived_at: string | null } | null }[];
}

/**
 * What an order's main action is now (D-096, D-097; flows.md §6.4): it ships once its export has arrived, or, express
 * (D-070), once every piece is picked in India. `unchecked`: picked pieces not yet ticked off as arrived.
 */
export function shipState(order: ShipCheck): { canShip: boolean; express: boolean; unpicked: number; unchecked: number } {
  const express = order.shipping_method === 'express' && !order.cycle_id; // courier straight from India
  const unpicked = order.items.filter((i) => i.status === 'active' && i.pickup?.status === 'pending').length;
  const canShip = express ? ['confirmed', 'collecting'].includes(order.status) && unpicked === 0 : order.status === 'arrived';
  const unchecked = express ? 0 : order.items.filter((i) => i.pickup?.status === 'picked' && !i.pickup.arrived_at).length;
  return { canShip, express, unpicked, unchecked };
}

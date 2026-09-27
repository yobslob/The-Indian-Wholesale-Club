/**
 * What customers see about their order (flows.md §8, D-003, D-034). The SQL
 * views already collapse internal statuses into these seven values.
 */
export const CUSTOMER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  pending: 'Payment pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing your order', // D-034
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/** The happy-path steps of the order timeline, in order. */
export const CUSTOMER_TIMELINE: readonly CustomerStatus[] = ['confirmed', 'preparing', 'shipped', 'delivered'];

/** Index in CUSTOMER_TIMELINE, or -1 for statuses outside it (pending, cancelled, refunded). */
export function timelineIndex(status: CustomerStatus): number {
  return CUSTOMER_TIMELINE.indexOf(status);
}

/**
 * Customer-visible order_events.kind → text. Kinds are written by SQL functions
 * (create_order, cutoff_cycle, mark_pickup, change_delivery_window) and by admin actions.
 * The text never mentions shops or India-side operations (D-003).
 */
export const ORDER_EVENT_LABEL: Record<string, string> = {
  order_confirmed: 'Order confirmed',
  preparing: 'Preparing your order',
  item_unavailable: 'An item is no longer available. It will be refunded.', // D-030
  item_refunded: 'Item refunded',
  delivery_window_changed: 'New delivery estimate', // D-008
  shipped: 'Shipped',
  delivered: 'Delivered',
};

/** Unknown kinds fall back to a neutral label rather than exposing the raw kind. */
export function orderEventLabel(kind: string): string {
  return ORDER_EVENT_LABEL[kind] ?? 'Order updated';
}

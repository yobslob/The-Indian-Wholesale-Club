import type { OrderStatusEnum } from '../types';

/**
 * Valid order status transitions allowed by the business lifecycle state machine.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatusEnum, OrderStatusEnum[]> = {
  pending: ['confirmed', 'processing', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'out_for_delivery', 'delivered'],
  in_transit: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

/**
 * Validate whether an order can transition from current status to target status.
 */
export function canTransitionOrder(current: OrderStatusEnum, next: OrderStatusEnum): boolean {
  if (current === next) return true;
  const allowed = ALLOWED_ORDER_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

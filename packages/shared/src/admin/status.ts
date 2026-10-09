/**
 * Admin only: statuses in plain words and a colour (D-096), for the web panel's and the app's chips. The database's
 * words (`in_transit`, `partially_refunded`) are never shown. Customers see their own seven statuses (order-status.ts).
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'brand' | 'blue' | 'mute';

type OrderStatus = 'pending_payment' | 'confirmed' | 'collecting' | 'packed' | 'in_transit' | 'arrived' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
type PickupStatus = 'pending' | 'picked' | 'unavailable';
type CycleStatusName = 'open' | 'collecting' | 'packed' | 'exported' | 'arrived' | 'fulfilling' | 'closed';
type ProductStatus = 'draft' | 'live' | 'paused' | 'archived';

export const ORDER_STATUS: Record<OrderStatus, [string, Tone]> = {
  pending_payment: ['Awaiting payment', 'mute'],
  confirmed: ['Confirmed', 'blue'],
  collecting: ['Collecting in India', 'warn'],
  packed: ['Packed in India', 'warn'],
  in_transit: ['On the way to the US', 'warn'],
  arrived: ['Arrived · to ship', 'brand'],
  shipped: ['Shipped', 'ok'],
  delivered: ['Delivered', 'ok'],
  cancelled: ['Cancelled', 'mute'],
  refunded: ['Refunded', 'mute'],
};

export const PAYMENT_STATUS: Record<PaymentStatus, [string, Tone]> = {
  pending: ['Awaiting payment', 'mute'],
  paid: ['Paid', 'ok'],
  failed: ['Failed', 'bad'],
  refunded: ['Refunded', 'mute'],
  partially_refunded: ['Part refunded', 'warn'],
};

export const PICKUP_STATUS: Record<PickupStatus, [string, Tone]> = {
  pending: ['To pick', 'warn'],
  picked: ['Picked', 'ok'],
  unavailable: ['Unavailable', 'bad'],
};

export const CYCLE_STATUS: Record<CycleStatusName, [string, Tone]> = {
  open: ['Open', 'blue'],
  collecting: ['Collecting', 'warn'],
  packed: ['Packed', 'warn'],
  exported: ['Exported', 'warn'],
  arrived: ['Arrived', 'brand'],
  fulfilling: ['Fulfilling', 'brand'],
  closed: ['Closed', 'mute'],
};

export const PRODUCT_STATUS: Record<ProductStatus, [string, Tone]> = {
  draft: ['Draft', 'mute'],
  live: ['Live', 'ok'],
  paused: ['Paused', 'warn'],
  archived: ['Archived', 'mute'],
};

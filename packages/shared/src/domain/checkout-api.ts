/**
 * The checkout HTTP contract shared by the website and the app (both call the web
 * server's /api/checkout, /api/checkout/stock, /api/orders and /api/orders/lookup). Types only.
 */
import type { CheckoutBreakdown } from './checkout';
import type { CheckoutOffers } from './coupons';

export interface CheckoutRequestBody {
  email: string;
  address: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    zipCode: string;
    phone?: string | null;
  };
  lines: { variantId: string; quantity: number }[];
  promoCode?: string | null;
  /** D-191: use the account's coins (an older app does not send it: its bill has no line for them). */
  useCoins?: boolean;
}

export interface QuotedLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  regionName: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface DeliveryDates {
  est_delivery_from: string;
  est_delivery_to: string;
}

export interface CheckoutQuote {
  lines: QuotedLine[];
  breakdown: CheckoutBreakdown;
  /** TODO(D-187): drop when app <next version> is the minimum (the old app's summary reads it). */
  shippingMethod: 'standard';
  /** The order's window. */
  delivery: DeliveryDates;
  /**
   * TODO(D-187): drop when app <next version> is the minimum. The old app's picker destructures `options` and draws
   * nothing when `express` is null, so it must be null, never missing. Standard is the only shipping (§10 Y-1).
   */
  options: {
    standard: { shippingCents: number; delivery: DeliveryDates };
    express: null;
  };
  promoCode: string | null;
  /** A code was entered but is not valid right now. */
  promoRejected: boolean;
  /** D-191: the coupons to offer this customer and their coins. */
  offers?: CheckoutOffers;
  /** D-187: two shipments when the bag has food and other pieces (each with its dates and pieces); null for one. */
  shipments?: QuotedShipment[] | null;
  /** The bag has food but the address is outside the 48 states and DC (or a PO box, APO): one shipment. */
  outside?: boolean;
}

export interface QuotedShipment {
  seq: 1 | 2;
  kind: 'food' | 'standard';
  delivery: { est_delivery_from: string; est_delivery_to: string };
  variantIds: string[];
}

export interface CheckoutStartResponse {
  clientSecret: string;
  paymentIntentId: string;
  quote: CheckoutQuote;
}

/**
 * §10 Y-3: a line of the bag that cannot go ahead as it is: sold out, no longer on sale or fewer left than it asks.
 * `available` 0: "Not available right now", Remove. More: "Only 2 left", Keep 2.
 */
export interface StockProblemLine {
  variantId: string;
  /** Null only when the option no longer exists: show the bag's own words and photo. */
  productName: string | null;
  variantLabel: string | null;
  imagePath: string | null;
  /** How many the bag asks for. */
  quantity: number;
  available: number;
}

/** POST /api/checkout/stock: the bag's problem lines when checkout opens (empty: all fine). */
export interface CheckoutStockRequest {
  lines: { variantId: string; quantity: number }[];
}
export interface CheckoutStockResponse {
  lines: StockProblemLine[];
  /** D-191: the coupon box's coupons and the coins, shown from the moment checkout opens. */
  offers?: CheckoutOffers;
}

/** Why checkout cannot go ahead. Messages for customers never mention operations (D-003). */
export type CheckoutProblem =
  /** Payment stays locked until each line is removed or lowered (§10 Y-3). */
  | { kind: 'stock'; lines: StockProblemLine[] }
  /** The bag is below the smallest order (D-109). */
  | { kind: 'below_minimum'; minOrderCents: number; subtotalCents: number }
  | { kind: 'closed' };

export interface CheckoutErrorResponse {
  error: string;
  problem?: CheckoutProblem;
}

export interface FinalizeResponse {
  orderNumber: string;
}

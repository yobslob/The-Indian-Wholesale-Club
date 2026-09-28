/**
 * The checkout HTTP contract shared by the website and the app (both call the web
 * server's /api/checkout, /api/orders and /api/orders/lookup). Types only.
 */
import type { CheckoutBreakdown, ShippingMethod } from './checkout';

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
  shippingMethod?: ShippingMethod;
}

export interface QuotedLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  regionName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface DeliveryDates {
  est_delivery_from: string;
  est_delivery_to: string;
  order_by: string;
}

export interface CheckoutQuote {
  lines: QuotedLine[];
  breakdown: CheckoutBreakdown;
  shippingMethod: ShippingMethod;
  /** Window of the chosen option. */
  delivery: DeliveryDates;
  /** Both options for the picker; express is null until it is set up (D-041, Q-18). */
  options: {
    standard: { shippingCents: number; delivery: DeliveryDates };
    express: { shippingCents: number; delivery: DeliveryDates } | null;
  };
  promoCode: string | null;
  /** A code was entered but is not valid right now. */
  promoRejected: boolean;
}

export interface CheckoutStartResponse {
  clientSecret: string;
  paymentIntentId: string;
  quote: CheckoutQuote;
}

/** Why checkout cannot go ahead. Messages for customers never mention operations (D-003). */
export type CheckoutProblem =
  | { kind: 'unavailable'; variantIds: string[] }
  | { kind: 'sold_out'; variantIds: string[] }
  | { kind: 'express_unavailable' }
  | { kind: 'closed' };

export interface CheckoutErrorResponse {
  error: string;
  problem?: CheckoutProblem;
}

export interface FinalizeResponse {
  orderNumber: string;
}

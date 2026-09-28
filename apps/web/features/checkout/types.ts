/** Shapes shared by the checkout client and its API routes (no runtime code, no zod in the bundle). */
import type { CheckoutBreakdown } from '@repo/shared/domain';

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

export interface CheckoutQuote {
  lines: QuotedLine[];
  breakdown: CheckoutBreakdown;
  delivery: { est_delivery_from: string; est_delivery_to: string; order_by: string };
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
  | { kind: 'closed' };

export interface CheckoutErrorResponse {
  error: string;
  problem?: CheckoutProblem;
}

export interface FinalizeResponse {
  orderNumber: string;
}

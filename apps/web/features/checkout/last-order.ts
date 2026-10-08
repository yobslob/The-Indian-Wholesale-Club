import type { CheckoutQuote } from './types';

/** One piece as the bag summary draws it: what the device knows (photo, names) and, once priced, the server's price. */
export interface SummaryLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  regionName: string;
  quantity: number;
  totalCents: number;
  imagePath: string | null;
}

/** The priced bag of the payment in progress, so the thank-you page can show the pieces after the bag is cleared. */
export interface LastOrder {
  paymentIntentId: string;
  orderNumber: string | null;
  lines: SummaryLine[];
  quote: CheckoutQuote;
}

const KEY = 'iwc-last-order';

/**
 * Kept in sessionStorage: this tab only, gone when it closes, never sent anywhere. It survives a 3-D Secure redirect
 * back to /checkout/success. Storage can be off (private windows); then the thank-you page shows its text alone.
 */
export function saveLastOrder(order: LastOrder): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // storage unavailable: nothing to keep
  }
}

export function readLastOrder(match: { orderNumber: string | null; paymentIntentId: string | null }): LastOrder | null {
  try {
    const order = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as LastOrder | null;
    if (!order) return null;
    const same =
      (match.orderNumber !== null && order.orderNumber === match.orderNumber) ||
      (match.paymentIntentId !== null && order.paymentIntentId === match.paymentIntentId);
    return same ? order : null;
  } catch {
    return null;
  }
}

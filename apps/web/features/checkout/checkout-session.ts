import { z } from 'zod';

/**
 * The checkout in progress, kept in this tab's sessionStorage (gone when the tab closes, never sent anywhere but
 * our own /api/checkout): a refresh at Payment, or a 3-D Secure failure coming back, resumes at Payment on the same
 * payment with the same bag (launch QA A-8, A-4). Storage can be off (private windows): then checkout starts over.
 */
const KEY = 'iwc-checkout';
const NOTICE_KEY = 'iwc-checkout-notice';

const savedSchema = z.object({
  clientSecret: z.string().min(1),
  paymentIntentId: z.string().min(1),
  request: z.object({
    email: z.string(),
    address: z.object({
      fullName: z.string(),
      line1: z.string(),
      line2: z.string().nullish(),
      city: z.string(),
      state: z.string(),
      zipCode: z.string(),
      phone: z.string().nullish(),
    }),
    lines: z.array(z.object({ variantId: z.string(), quantity: z.number().int() })).min(1),
    promoCode: z.string().nullish(),
  }),
});
export type SavedCheckout = z.infer<typeof savedSchema>;

export function saveCheckout(saved: SavedCheckout): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // storage unavailable: a refresh starts over
  }
}

export function clearCheckout(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing kept
  }
}

/** The saved checkout, only when it is for exactly this bag (same pieces, same quantities). */
export function readCheckout(bag: { variantId: string; quantity: number }[]): SavedCheckout | null {
  try {
    const parsed = savedSchema.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? 'null'));
    if (!parsed.success) return null;
    return sameBag(parsed.data.request.lines, bag) ? parsed.data : null;
  } catch {
    return null;
  }
}

export function sameBag(
  a: readonly { variantId: string; quantity: number }[],
  b: readonly { variantId: string; quantity: number }[],
): boolean {
  const key = (lines: readonly { variantId: string; quantity: number }[]) =>
    lines
      .map((l) => `${l.variantId}x${l.quantity}`)
      .sort()
      .join(',');
  return a.length > 0 && key(a) === key(b);
}

/** A message for the checkout page to show once (a payment that failed after a 3-D Secure redirect). */
export function savePaymentNotice(message: string): void {
  try {
    sessionStorage.setItem(NOTICE_KEY, message);
  } catch {
    // shown nowhere: the customer still lands back on checkout with the bag
  }
}

export function takePaymentNotice(): string | null {
  try {
    const message = sessionStorage.getItem(NOTICE_KEY);
    sessionStorage.removeItem(NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}

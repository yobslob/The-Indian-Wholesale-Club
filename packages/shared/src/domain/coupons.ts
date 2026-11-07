/**
 * D-191: the coupon box at checkout. Pure: the server sends the coupons, these pick the one to put on top. Every total is
 * still worked out on the server (quoteCheckout).
 */
import { promoDiscountCents, type QuotePromo } from './checkout';

export interface PublicCoupon extends QuotePromo {
  code: string;
  /** Only for someone with no paid order yet. */
  newCustomersOnly: boolean;
}

export interface CheckoutOffers {
  coupons: PublicCoupon[];
  /** No paid order on this account or email yet. A guest's email is unknown until Delivery: treated as new till then. */
  isNewCustomer: boolean;
  /** The account's coins; null for a guest (coins need an account). */
  coins: number | null;
}

const dollars = (cents: number): string => (cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`);

/** "10% off, up to $9" or "$7 off". */
export function couponTitle(c: PublicCoupon): string {
  return c.discountType === 'percentage'
    ? `${c.discountValue}% off${c.maxDiscountCents ? `, up to ${dollars(c.maxDiscountCents)}` : ''}`
    : `${dollars(c.discountValue)} off`;
}

/** "On your first order" or "On bags of $99 or more". */
export function couponTerms(c: PublicCoupon): string {
  if (c.newCustomersOnly) return 'On your first order';
  return c.minOrderCents > 0 ? `On bags of ${dollars(c.minOrderCents)} or more` : 'On any bag';
}

const canUse = (c: PublicCoupon, offers: Pick<CheckoutOffers, 'isNewCustomer'>): boolean =>
  !c.newCustomersOnly || offers.isNewCustomer;

/**
 * The coupon that takes the most off this bag. A coupon replaces the bulk saving, so it must beat `bulkCents` to be worth
 * applying; null when none does.
 */
export function bestCoupon(
  offers: Pick<CheckoutOffers, 'coupons' | 'isNewCustomer'>,
  subtotalCents: number,
  bulkCents = 0,
): PublicCoupon | null {
  let best: PublicCoupon | null = null;
  let most = bulkCents;
  for (const c of offers.coupons) {
    if (!canUse(c, offers)) continue;
    const off = promoDiscountCents(subtotalCents, c);
    if (off > most) {
      best = c;
      most = off;
    }
  }
  return best;
}

/** The nearest coupon this bag has not reached yet, and how much more it takes; null when none is left. */
export function nextCoupon(
  offers: Pick<CheckoutOffers, 'coupons' | 'isNewCustomer'>,
  subtotalCents: number,
): { coupon: PublicCoupon; moreCents: number } | null {
  const ahead = offers.coupons
    .filter((c) => canUse(c, offers) && c.minOrderCents > subtotalCents)
    .sort((a, b) => a.minOrderCents - b.minOrderCents)[0];
  return ahead ? { coupon: ahead, moreCents: ahead.minOrderCents - subtotalCents } : null;
}

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

/**
 * The nearest coupon this bag has not reached that would truly be its best there and beats what it saves now (`beatCents`),
 * so "Add $39 more for $7 off" is never said to someone whose $9 coupon would still win. Null when none is left.
 */
export function nextCoupon(
  offers: Pick<CheckoutOffers, 'coupons' | 'isNewCustomer'>,
  subtotalCents: number,
  beatCents = 0,
): { coupon: PublicCoupon; moreCents: number } | null {
  const ahead = offers.coupons
    .filter(
      (c) =>
        canUse(c, offers) &&
        c.minOrderCents > subtotalCents &&
        promoDiscountCents(c.minOrderCents, c) > beatCents &&
        bestCoupon(offers, c.minOrderCents)?.code === c.code,
    )
    .sort((a, b) => a.minOrderCents - b.minOrderCents)[0];
  return ahead ? { coupon: ahead, moreCents: ahead.minOrderCents - subtotalCents } : null;
}

/** Where a coupon stands on this bag: what the coupon list draws, coloured with Apply or greyed with the reason. */
export type CouponStanding =
  | { kind: 'usable'; offCents: number }
  | { kind: 'short'; moreCents: number }
  | { kind: 'first-order' }
  | { kind: 'bulk-bigger' };

export function couponStanding(
  c: PublicCoupon,
  offers: Pick<CheckoutOffers, 'isNewCustomer'>,
  subtotalCents: number,
  bulkCents = 0,
): CouponStanding {
  if (!canUse(c, offers)) return { kind: 'first-order' };
  if (subtotalCents < c.minOrderCents) return { kind: 'short', moreCents: c.minOrderCents - subtotalCents };
  const offCents = promoDiscountCents(subtotalCents, c);
  return offCents > bulkCents ? { kind: 'usable', offCents } : { kind: 'bulk-bigger' };
}

/** The list's order: what can be used now, the most off first; then the nearest to reach; then the rest. */
export function sortedCoupons(
  offers: Pick<CheckoutOffers, 'coupons' | 'isNewCustomer'>,
  subtotalCents: number,
  bulkCents = 0,
): { coupon: PublicCoupon; standing: CouponStanding }[] {
  const rank = (s: CouponStanding): number =>
    s.kind === 'usable' ? 1e9 - s.offCents : s.kind === 'short' ? 2e9 + s.moreCents : s.kind === 'bulk-bigger' ? 4e9 : 5e9;
  return offers.coupons
    .map((coupon) => ({ coupon, standing: couponStanding(coupon, offers, subtotalCents, bulkCents) }))
    .sort((a, b) => rank(a.standing) - rank(b.standing));
}

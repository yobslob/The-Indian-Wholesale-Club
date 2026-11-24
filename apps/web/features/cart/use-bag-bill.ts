'use client';

import { billOf, bulkSavingCents, couponStanding, quoteCheckout, type Bill, type CheckoutOffers, type PublicCoupon } from '@repo/shared/domain';

import { useGiftCents } from '@/features/send-home/use-gift';

import { bagKey, useBagCharges } from './charges';
import { useOffers } from './offers';
import { cartSubtotalCents, useCart } from './store';

export interface BagBill {
  subtotalCents: number;
  /** Null until the bag's charges are in; the bill then draws its shape rather than a figure that may move. */
  bill: Bill | null;
  /** The charges are still the last bag's for a moment. */
  updating: boolean;
  offers: CheckoutOffers | null;
  failed: boolean;
  retry: () => void;
  /** The code the customer picked, whether or not it counts on this bag right now. */
  picked: string | null;
  /** The picked coupon, when it counts on this bag. */
  coupon: PublicCoupon | null;
  /** The bulk saving this bag has without a coupon: a coupon has to beat it. */
  bulkCents: number;
  /** D-205: the bag's total before any Send home gift (the round-up is worked out from it); null until the charges are in. */
  goodsTotalCents: number | null;
}

/**
 * D-192: the bag's bill, worked out by quoteCheckout: the same sum the server does, with the same charges and coupon, so
 * the only thing checkout adds is the state's sales tax. Applying a coupon is therefore instant and needs no request.
 */
export function useBagBill(fetchOffers = true): BagBill {
  const lines = useCart((s) => s.lines);
  const picked = useCart((s) => s.promoCode);
  const charges = useBagCharges();
  const { offers, failed, retry } = useOffers(fetchOffers);
  const subtotalCents = cartSubtotalCents(lines);
  const bulkCents = charges ? bulkSavingCents(subtotalCents, charges.bulkFromCents, charges.bulk) : 0;
  const found = picked ? offers?.coupons.find((c) => c.code === picked) : undefined;
  const coupon = found && offers && couponStanding(found, offers, subtotalCents, bulkCents).kind === 'usable' ? found : null;
  // D-205: the gift is added after everything else, so the goods' sum is the same with or without it
  const quote = (gift: number) =>
    charges && lines.length > 0
      ? quoteCheckout(
          lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
          coupon,
          {
            flatCents: 0,
            freeMinCents: charges.freeMinCents,
            bulkFromCents: charges.bulkFromCents,
            smallOrder: charges.small,
            bulkSaving: charges.bulk,
            heavy: charges.heavy,
          },
          null,
          offers?.coins ?? 0,
          gift,
        )
      : null;
  const goods = quote(0);
  const giftCents = useGiftCents(goods?.totalCents ?? null);
  const breakdown = giftCents > 0 ? quote(giftCents) : goods;
  return {
    subtotalCents,
    bill: breakdown ? billOf(breakdown, coupon?.code ?? null, false) : null,
    updating: Boolean(charges && charges.key !== bagKey(lines)),
    offers,
    failed,
    retry,
    picked,
    coupon,
    bulkCents,
    goodsTotalCents: goods?.totalCents ?? null,
  };
}

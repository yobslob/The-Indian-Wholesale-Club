'use client';

import { billOf, bulkSavingCents, quoteCheckout, type Bill, type CheckoutOffers, type PublicCoupon } from '@repo/shared/domain';

import { useMoney } from '@/features/shell/market';

import { chargesKey, useBagCharges } from './charges';
import { linePricedFor } from './country-bag';
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
  /** D-208: coupons are gone; always null (kept for the panel and checkout's older reads). */
  picked: string | null;
  coupon: PublicCoupon | null;
  /** The bulk saving this bag has without a coupon: a coupon has to beat it. */
  bulkCents: number;
  /** The bag's total; null until the charges are in. */
  goodsTotalCents: number | null;
  /** D-208: the goods the 5% saving is worked out on (after the bulk saving); null until the charges are in. */
  saveBaseCents: number | null;
}

/**
 * D-192: the bag's bill, worked out by quoteCheckout: the same sum the server does, with the same charges, so the only
 * thing checkout adds is the state's sales tax. D-208: no coupon, and the 5% saving is never in the bill.
 */
export function useBagBill(fetchOffers = true): BagBill {
  const lines = useCart((s) => s.lines);
  const { market } = useMoney();
  const charges = useBagCharges();
  const { offers, failed, retry } = useOffers(fetchOffers);
  const subtotalCents = cartSubtotalCents(lines);
  const bulkCents = charges ? bulkSavingCents(subtotalCents, charges.bulkFromCents, charges.bulk) : 0;
  const breakdown =
    charges && lines.length > 0
      ? quoteCheckout(
          lines.map((l) => ({ unitPriceCents: l.unitPriceCents, quantity: l.quantity })),
          null,
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
        )
      : null;
  return {
    subtotalCents,
    bill: breakdown ? billOf(breakdown, null, false) : null,
    // D-208: also while a line is still priced for another country (country-bag.ts is pricing it)
    updating: Boolean(charges && charges.key !== chargesKey(lines, market)) || lines.some((l) => !linePricedFor(l, market)),
    offers,
    failed,
    retry,
    picked: null,
    coupon: null,
    bulkCents,
    goodsTotalCents: breakdown?.totalCents ?? null,
    saveBaseCents: breakdown ? breakdown.subtotalCents - breakdown.bulkSavingCents : null,
  };
}

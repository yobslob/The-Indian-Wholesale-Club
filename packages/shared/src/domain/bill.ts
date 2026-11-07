/**
 * D-192: the one bill. The bag, checkout and the thank-you page all draw this, from quoteCheckout's own answer, so a figure
 * cannot read one way in one place and another way in the next. Pure.
 */
import type { CheckoutBreakdown } from './checkout';

export interface Bill {
  subtotalCents: number;
  couponCode: string | null;
  couponCents: number;
  bulkCents: number;
  /** The coins used; one coin takes one cent off. */
  coins: number;
  shippingCents: number;
  /** What free Shipping would have been (0: nothing to strike through). */
  shippingWasCents: number;
  retailerCents: number;
  heavyCents: number;
  /** Heavy-item shipping before its % came off (0: nothing to strike through). */
  heavyWasCents: number;
  /** Null until the address says which state's tax applies. */
  taxCents: number | null;
  totalCents: number;
  /** Everything taken off: a note under the total, never part of the sum. */
  savingCents: number;
}

/** A saved order from before D-191 may lack the newer parts: they count as none. */
type Breakdown = Pick<CheckoutBreakdown, 'subtotalCents' | 'discountCents' | 'shippingCents' | 'taxCents' | 'totalCents'> &
  Partial<Pick<CheckoutBreakdown, 'bulkSavingCents' | 'coinsUsed' | 'retailerCents' | 'heavyCents' | 'heavyShownCents'>> & {
    waivedCents?: { shipping: number };
  };

export function billOf(b: Breakdown, couponCode: string | null, taxKnown: boolean): Bill {
  const bulkCents = b.bulkSavingCents ?? 0;
  const coins = b.coinsUsed ?? 0;
  const heavyCents = b.heavyCents ?? 0;
  const heavyShown = b.heavyShownCents ?? 0;
  const heavyWasCents = heavyShown > heavyCents ? heavyShown : 0;
  const shippingWasCents = b.shippingCents === 0 ? (b.waivedCents?.shipping ?? 0) : 0;
  return {
    subtotalCents: b.subtotalCents,
    couponCode: b.discountCents > 0 ? couponCode : null,
    couponCents: b.discountCents,
    bulkCents,
    coins,
    shippingCents: b.shippingCents,
    shippingWasCents,
    retailerCents: b.retailerCents ?? 0,
    heavyCents,
    heavyWasCents,
    taxCents: taxKnown ? b.taxCents : null,
    totalCents: b.totalCents,
    savingCents: shippingWasCents + (heavyWasCents ? heavyWasCents - heavyCents : 0) + bulkCents + b.discountCents + coins,
  };
}

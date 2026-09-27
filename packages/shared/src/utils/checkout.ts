import {
  DEFAULT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
} from '../constants';
import type {
  CheckoutCostBreakdown,
  PromoCode,
  ShippingTier,
} from '../types';

export const STANDARD_SHIPPING_CENTS = DEFAULT_SHIPPING_CENTS; // 599 cents ($5.99)
export const EXPRESS_SHIPPING_CENTS = 1299; // 1299 cents ($12.99)
export const ESTIMATED_TAX_RATE = 0.08; // 8% estimated US sales tax

/**
 * Calculate shipping cents based on discounted subtotal, shipping tier, and promo code.
 */
export function calculateShipping(
  discountedSubtotalCents: number,
  tier: ShippingTier = 'standard',
  promoCode?: string | null,
): number {
  if (discountedSubtotalCents <= 0) return 0;
  if (tier === 'express') return EXPRESS_SHIPPING_CENTS;

  const isFreeShipPromo = promoCode?.trim().toUpperCase() === 'FREESHIP';
  if (discountedSubtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS || isFreeShipPromo) {
    return 0;
  }
  return STANDARD_SHIPPING_CENTS;
}

/**
 * Calculate estimated US sales tax on taxable amount (discounted subtotal + shipping).
 */
export function calculateTax(taxableCents: number): number {
  if (taxableCents <= 0) return 0;
  return Math.round(taxableCents * ESTIMATED_TAX_RATE);
}

/**
 * Authoritative single source of truth for checkout and cart financial calculations.
 */
export function calculateCheckoutBreakdown(
  subtotalCents: number,
  discountCents: number = 0,
  shippingTier: ShippingTier = 'standard',
  promo?: PromoCode | null,
): CheckoutCostBreakdown {
  const promoCodeClean = promo?.code?.trim().toUpperCase();
  const isFreeShipPromo = promoCodeClean === 'FREESHIP';

  // If FREESHIP promo code is applied, the benefit is free shipping;
  // do not double-discount product subtotal if it was configured as a 599-cent fixed promo.
  let effectiveDiscountCents = Math.max(0, discountCents);
  if (isFreeShipPromo && promo?.discount_type === 'fixed' && promo?.discount_value === 599) {
    effectiveDiscountCents = 0;
  }
  effectiveDiscountCents = Math.min(subtotalCents, effectiveDiscountCents);

  const discountedSubtotal = Math.max(0, subtotalCents - effectiveDiscountCents);
  const shippingCents = calculateShipping(discountedSubtotal, shippingTier, promoCodeClean);
  const taxCents = calculateTax(discountedSubtotal + shippingCents);
  const totalCents = Math.max(0, discountedSubtotal + shippingCents + taxCents);

  return {
    subtotalCents,
    discountCents: effectiveDiscountCents,
    shippingCents,
    taxCents,
    totalCents,
    appliedPromo: promo
      ? {
          code: promo.code,
          discountType: promo.discount_type,
          discountValue: promo.discount_value,
          amountCents: isFreeShipPromo ? STANDARD_SHIPPING_CENTS : effectiveDiscountCents,
        }
      : null,
  };
}

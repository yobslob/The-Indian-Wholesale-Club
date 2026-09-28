import { emailSchema, shippingAddressSchema, US_STATES } from '@repo/shared/domain';

import type { BagLine } from '../cart/store';
import type { CheckoutRequestBody, ShippingMethod } from '@repo/shared/domain';

/** Checkout details → request body. Pure (no React Native), so it has unit tests. */

export interface Details {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  promoCode: string;
}

export const EMPTY_DETAILS: Details = {
  email: '',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  promoCode: '',
};

/** "nj", "NJ" or "New Jersey" → "NJ"; anything else is left for the schema to reject. */
export function stateCode(value: string): string {
  const v = value.trim().toLowerCase();
  return (
    US_STATES.find((s) => s.code.toLowerCase() === v || s.name.toLowerCase() === v)?.code ?? value
  );
}

/**
 * The checkout request, checked on the phone with the same schemas the server
 * uses (quick messages only; the server checks everything again).
 */
export function toCheckoutRequest(
  details: Details,
  lines: BagLine[],
  shippingMethod: ShippingMethod,
): { body: CheckoutRequestBody } | { error: string } {
  const email = emailSchema.safeParse(details.email);
  if (!email.success)
    return { error: email.error.issues[0]?.message ?? 'Enter a valid email address' };
  const address = shippingAddressSchema.safeParse({ ...details, state: stateCode(details.state) });
  if (!address.success)
    return { error: address.error.issues[0]?.message ?? 'Please check your address' };
  return {
    body: {
      email: email.data,
      address: address.data,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      promoCode: details.promoCode.trim() || null,
      shippingMethod,
    },
  };
}

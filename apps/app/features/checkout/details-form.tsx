import { View } from 'react-native';

import { emailSchema, shippingAddressSchema, US_STATES } from '@repo/shared/domain';

import type { BagLine } from '@/features/cart/store';
import type { CheckoutRequestBody, ShippingMethod } from '@repo/shared/domain';

import { Field } from '@/components/ui';

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
function stateCode(value: string): string {
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

/** Email, US shipping address and promo code. */
export function DetailsForm({
  value,
  onChange,
}: {
  value: Details;
  onChange: (next: Details) => void;
}): React.JSX.Element {
  const set = (key: keyof Details) => (text: string) => onChange({ ...value, [key]: text });
  return (
    <>
      <Field
        label="Email"
        value={value.email}
        onChangeText={set('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <Field
        label="Full name"
        value={value.fullName}
        onChangeText={set('fullName')}
        autoComplete="name"
        textContentType="name"
      />
      <Field
        label="Street address"
        value={value.line1}
        onChangeText={set('line1')}
        autoComplete="address-line1"
        textContentType="streetAddressLine1"
      />
      <Field
        label="Apartment, suite (optional)"
        value={value.line2}
        onChangeText={set('line2')}
        autoComplete="address-line2"
        textContentType="streetAddressLine2"
      />
      <Field
        label="City"
        value={value.city}
        onChangeText={set('city')}
        textContentType="addressCity"
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field
            label="State"
            placeholder="NJ"
            value={value.state}
            onChangeText={set('state')}
            autoCapitalize="characters"
            textContentType="addressState"
          />
        </View>
        <View className="flex-1">
          <Field
            label="ZIP code"
            value={value.zipCode}
            onChangeText={set('zipCode')}
            keyboardType="number-pad"
            autoComplete="postal-code"
            textContentType="postalCode"
          />
        </View>
      </View>
      <Field
        label="Phone (optional)"
        value={value.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <Field
        label="Promo code (optional)"
        value={value.promoCode}
        onChangeText={set('promoCode')}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </>
  );
}

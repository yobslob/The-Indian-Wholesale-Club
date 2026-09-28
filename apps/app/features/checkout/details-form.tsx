import { View } from 'react-native';

import type { Details } from './request';

import { Field } from '@/components/ui';

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

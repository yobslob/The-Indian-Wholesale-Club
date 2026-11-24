import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { anyPhone, formatUsPhone } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import type { Details } from './request';

import { Body, Button, ErrorText, Field } from '@/components/ui';
import { countryNameOf, useCountry } from '@/features/shell/country';
import { API_BASE_URL } from '@/lib/api';

/** One checkout step (D-087): its number and title; open, its body; done, a summary line and Edit. */
export function Step({
  n,
  title,
  state,
  summary,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  state: 'open' | 'done' | 'later';
  summary?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  const dot = state === 'open' ? 'bg-ink' : state === 'done' ? 'bg-positive' : 'bg-surface';
  return (
    <View className="border-line border-t py-3.5">
      <View className="flex-row items-center gap-3">
        <View className={`h-7 w-7 items-center justify-center rounded-full ${dot}`}>
          <Text className={`font-ui-semibold text-[13px] ${state === 'later' ? 'text-ink-muted' : 'text-paper'}`}>{state === 'done' ? '✓' : n}</Text>
        </View>
        <Text accessibilityRole="header" className={`font-heading flex-1 text-[19px] ${state === 'later' ? 'text-ink-muted' : 'text-[#1D1A17]'}`}>
          {title}
        </Text>
        {state === 'done' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title.toLowerCase()}`} onPress={onEdit} className="border-line bg-paper min-h-9 flex-row items-center gap-1.5 rounded-pill border px-3">
            <Ionicons name="pencil-outline" size={14} color={tokens.colors.ink} />
            <Text className="font-ui text-ink text-[13px]">Edit</Text>
          </Pressable>
        ) : null}
      </View>
      {state === 'done' && summary ? <Text className="font-body text-ink-muted ml-10 mt-1.5 text-[13px]">{summary}</Text> : null}
      {state === 'open' ? <View className="gap-3.5 pb-1 pt-3.5">{children}</View> : null}
    </View>
  );
}

/** Step 1 (D-087): the phone number, +1 with the US flag; for delivery only, no code sent. D-208: abroad, with its country code. */
export function PhoneStep({ value, onDone }: { value: string; onDone: (digits: string) => void }): React.JSX.Element {
  const { country } = useCountry();
  const abroad = country !== 'us' || value.startsWith('+');
  const [text, setText] = useState(value ? (value.startsWith('+') ? value : formatUsPhone(value).slice(abroad ? 0 : 3)) : '');
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <View className="gap-1.5">
        <Text className="font-ui text-ink text-[13px]">Phone number</Text>
        <View className="flex-row">
          {abroad ? null : (
            <View className="border-line bg-surface min-h-12 flex-row items-center gap-1.5 rounded-l-md border border-r-0 px-3" accessibilityLabel="United States, +1">
              <Text className="text-base">🇺🇸</Text>
              <Text className="font-ui text-ink text-[15px]">+1</Text>
            </View>
          )}
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            placeholder={abroad ? '+44 20 7946 0958' : '(732) 555-0142'}
            placeholderTextColor={tokens.colors['ink-muted']}
            accessibilityLabel="Phone number"
            className={`border-line bg-paper text-ink font-ui min-h-12 flex-1 border px-3.5 text-[15px] ${abroad ? 'rounded-md' : 'rounded-r-md'}`}
          />
        </View>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        label="Continue"
        onPress={() => {
          const digits = anyPhone(text);
          if (!digits) return setError(abroad ? 'Enter your phone number with its country code, like +44 20 7946 0958.' : 'Enter a 10-digit US phone number.');
          setError(null);
          onDone(digits);
        }}
      />
      <Body muted>For delivery only. We don&apos;t text you anything at checkout.</Body>
    </>
  );
}

/**
 * Step 2 (D-087): name, email, the ZIP with the city and state filled in from our own list (the website's /api/zip,
 * D-098; an unknown ZIP asks for them), street and apartment. D-208: no coupons; abroad (the shopper's country on
 * Profile) the country's own fields.
 */
export function DeliveryStep({
  value,
  onChange,
  busy,
  error,
  onDone,
}: {
  value: Details;
  onChange: (next: Details) => void;
  busy: boolean;
  error: string | null;
  onDone: () => void;
}): React.JSX.Element {
  const [lookup, setLookup] = useState<'idle' | 'found' | 'unknown'>(value.city ? 'found' : 'idle');
  const [editPlace, setEditPlace] = useState(false);
  const set = (key: keyof Details) => (text: string) => onChange({ ...value, [key]: text });
  // D-208: the address is in the shopper's country (Profile); abroad its own fields, no ZIP lookup
  const { country, countries } = useCountry();
  const abroad = country !== 'us';
  useEffect(() => {
    if (value.country !== country) onChange({ ...value, country, ...(value.country ? { city: '', state: '', zipCode: '' } : {}) });
    // only when the country changes
  }, [country]);

  useEffect(() => {
    if (abroad || !/^\d{5}$/.test(value.zipCode) || lookup === 'found') return;
    let gone = false;
    void fetch(`${API_BASE_URL}/api/zip?zip=${value.zipCode}`)
      .then(async (res) => (res.ok ? ((await res.json()) as { city: string; state: string }) : null))
      .catch(() => null)
      .then((hit) => {
        if (gone) return;
        if (hit) {
          onChange({ ...value, city: hit.city, state: hit.state });
          setLookup('found');
        } else setLookup('unknown');
      });
    return () => {
      gone = true;
    };
    // Looks up each new five-digit ZIP once; `value` changes as the customer types elsewhere.
  }, [value.zipCode, lookup]);

  const askPlace = editPlace || lookup === 'unknown';
  if (abroad)
    return (
      <>
        <Body muted>Delivering to {countryNameOf(countries, country)}. Change the country on Profile.</Body>
        <Field label="Full name" value={value.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" />
        <Field label="Email" value={value.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
        <Field label="Street address" value={value.line1} onChangeText={set('line1')} autoComplete="address-line1" textContentType="streetAddressLine1" />
        <Field label="Apartment, suite (optional)" value={value.line2} onChangeText={set('line2')} autoComplete="address-line2" textContentType="streetAddressLine2" />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="City" value={value.city} onChangeText={set('city')} textContentType="addressCity" />
          </View>
          <View className="flex-1">
            <Field label="Postal code" value={value.zipCode} onChangeText={set('zipCode')} maxLength={12} autoComplete="postal-code" textContentType="postalCode" />
          </View>
        </View>
        <Field label="State, province or region (optional)" value={value.state} onChangeText={set('state')} textContentType="addressState" />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button label={busy ? 'Checking your bag…' : 'Continue to payment'} onPress={onDone} disabled={busy} />
        <Body muted>You will see the total and delivery window before paying, in US dollars.</Body>
      </>
    );
  return (
    <>
      <Field label="Full name" value={value.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" />
      <Field label="Email" value={value.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
      <View className="w-1/2 pr-1.5">
        <Field
          label="ZIP code"
          value={value.zipCode}
          onChangeText={(t) => {
            setLookup('idle');
            setEditPlace(false);
            onChange({ ...value, zipCode: t.replace(/\D/g, '').slice(0, 5), city: '', state: '' });
          }}
          keyboardType="number-pad"
          maxLength={5}
          autoComplete="postal-code"
          textContentType="postalCode"
        />
      </View>
      {lookup === 'found' && !editPlace ? (
        <View className="-mt-1.5 flex-row items-center gap-2.5" accessibilityLiveRegion="polite">
          <Text className="font-ui text-positive text-sm">
            ✓ {value.city}, {value.state}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit city and state" onPress={() => setEditPlace(true)} className="border-line bg-paper rounded-pill border px-2.5 py-1">
            <Text className="font-ui text-ink text-[13px]">Edit</Text>
          </Pressable>
        </View>
      ) : lookup === 'unknown' ? (
        <Text className="font-body text-ink-muted -mt-1.5 text-sm">We could not find that ZIP; type the city and state.</Text>
      ) : null}
      {askPlace ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="City" value={value.city} onChangeText={set('city')} textContentType="addressCity" />
          </View>
          <View className="flex-1">
            <Field label="State" placeholder="NJ" value={value.state} onChangeText={set('state')} autoCapitalize="characters" textContentType="addressState" />
          </View>
        </View>
      ) : null}
      <Field label="Street address" value={value.line1} onChangeText={set('line1')} autoComplete="address-line1" textContentType="streetAddressLine1" />
      <Field label="Apartment, suite (optional)" value={value.line2} onChangeText={set('line2')} autoComplete="address-line2" textContentType="streetAddressLine2" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label={busy ? 'Checking your bag…' : 'Continue to payment'} onPress={onDone} disabled={busy} />
      <Body muted>You will see the total and delivery window before paying.</Body>
    </>
  );
}

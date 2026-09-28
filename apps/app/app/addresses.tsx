import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  addMyAddress,
  deleteMyAddress,
  listMyAddresses,
  setDefaultAddress,
} from '@repo/db/account';
import { shippingAddressSchema } from '@repo/shared/domain';

import {
  Body,
  Button,
  Card,
  ErrorText,
  Field,
  Heading,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const EMPTY = {
  label: '',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
};

/** Saved US addresses (the account's own rows, RLS-scoped). The default one prefills checkout. */
export default function AddressesScreen(): React.JSX.Element {
  const { ready, session } = useSession();
  const userId = session?.user.id ?? '';
  const { data, error, loading, reload } = useQuery(`addresses:${userId}`, () =>
    userId ? listMyAddresses(supabase) : Promise.resolve([]),
  );
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (ready && !session) return <Redirect href="/auth/login" />;

  async function run(task: () => Promise<void>): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await task();
      reload();
    } catch {
      setActionError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function add(): Promise<void> {
    const parsed = shippingAddressSchema.safeParse(form);
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? 'Please check the address');
      return;
    }
    await run(async () => {
      await addMyAddress(supabase, userId, { ...parsed.data, label: form.label.trim() || null });
      setForm(EMPTY);
    });
  }

  const set = (key: keyof typeof EMPTY) => (text: string) =>
    setForm((f) => ({ ...f, [key]: text }));

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Addresses</Title>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>No saved addresses yet.</Body> : null}
      {data?.map((a) => (
        <Card key={a.id}>
          <Text className="text-ink font-medium">
            {a.label ?? a.full_name}
            {a.is_default ? ' · Default' : ''}
          </Text>
          <Body muted>
            {[a.full_name, a.line1, a.line2, `${a.city}, ${a.state} ${a.zip_code}`]
              .filter(Boolean)
              .join('\n')}
          </Body>
          <View className="flex-row gap-4">
            {!a.is_default ? (
              <Button
                kind="link"
                label="Make default"
                disabled={busy}
                onPress={() => void run(() => setDefaultAddress(supabase, userId, a.id))}
              />
            ) : null}
            <Button
              kind="link"
              label="Remove"
              disabled={busy}
              onPress={() => void run(() => deleteMyAddress(supabase, a.id))}
            />
          </View>
        </Card>
      ))}

      <Heading>Add an address</Heading>
      <Field
        label="Label (optional)"
        placeholder="Home"
        value={form.label}
        onChangeText={set('label')}
      />
      <Field
        label="Full name"
        value={form.fullName}
        onChangeText={set('fullName')}
        autoComplete="name"
      />
      <Field
        label="Street address"
        value={form.line1}
        onChangeText={set('line1')}
        autoComplete="address-line1"
      />
      <Field label="Apartment, suite (optional)" value={form.line2} onChangeText={set('line2')} />
      <Field label="City" value={form.city} onChangeText={set('city')} />
      <Field
        label="State (2 letters)"
        placeholder="NJ"
        value={form.state}
        onChangeText={set('state')}
        autoCapitalize="characters"
        maxLength={2}
      />
      <Field
        label="ZIP code"
        value={form.zipCode}
        onChangeText={set('zipCode')}
        keyboardType="number-pad"
      />
      <Field
        label="Phone (optional)"
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
      />
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <Button label="Save address" onPress={() => void add()} disabled={busy} />
    </Screen>
  );
}

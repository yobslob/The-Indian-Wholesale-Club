import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { addMyAddress, listMyAddresses, updateMyAddress } from '@repo/db/account';
import { shippingAddressSchema } from '@repo/shared/domain';

import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { clearQueryCache } from '@/lib/use-query';

const EMPTY = { label: '', fullName: '', line1: '', line2: '', city: '', state: '', zipCode: '', phone: '' };

/**
 * Add an address, or edit one (`?id=`, the pencil on its card, D-089): today's form. The account's own rows only
 * (RLS). Saving goes back to the profile's Addresses.
 */
export default function AddressFormScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { ready, session } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editing: start from the saved address.
  useEffect(() => {
    if (!session || !id) return;
    void listMyAddresses(supabase).then((rows) => {
      const a = rows.find((r) => r.id === id);
      if (a) setForm({ label: a.label ?? '', fullName: a.full_name, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, zipCode: a.zip_code, phone: a.phone ?? '' });
    });
  }, [session, id]);

  if (ready && !session) return <Redirect href="/auth/login" />;
  const set = (key: keyof typeof EMPTY) => (text: string) => setForm((f) => ({ ...f, [key]: text }));

  async function save(): Promise<void> {
    if (!session) return;
    const parsed = shippingAddressSchema.safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Please check the address');
    setBusy(true);
    setError(null);
    try {
      const input = { ...parsed.data, label: form.label.trim() || null };
      if (id) await updateMyAddress(supabase, id, input);
      else await addMyAddress(supabase, session.user.id, input);
      clearQueryCache(); // the profile's address cards read fresh
      router.back();
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={id ? 'Edit address' : 'Add an address'}>
      <Field label="Label (optional)" placeholder="Home" value={form.label} onChangeText={set('label')} />
      <Field label="Full name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" />
      <Field label="Street address" value={form.line1} onChangeText={set('line1')} autoComplete="address-line1" />
      <Field label="Apartment, suite (optional)" value={form.line2} onChangeText={set('line2')} />
      <Field label="City" value={form.city} onChangeText={set('city')} />
      <Field label="State (2 letters)" placeholder="NJ" value={form.state} onChangeText={set('state')} autoCapitalize="characters" maxLength={2} />
      <Field label="ZIP code" value={form.zipCode} onChangeText={set('zipCode')} keyboardType="number-pad" />
      <Field label="Phone (optional)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button label="Save address" onPress={() => void save()} disabled={busy} />
    </Screen>
  );
}

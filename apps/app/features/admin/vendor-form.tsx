import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createVendor } from '@repo/db/admin';

import { useAction } from './use-action';

import { Button, ErrorText, Field, Heading } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const EMPTY = {
  shopName: '',
  ownerName: '',
  town: '',
  phone: '',
  whatsapp: '',
  paymentMethod: '',
  paymentReference: '',
  notes: '',
};

const orNull = (v: string) => v.trim() || null;

/**
 * Add a shop in about a minute (admin.md §Vendors), the same fields as the web
 * panel. Photo and licences come with camera upload (coding phase).
 */
export function VendorForm({
  regions,
  onDone,
}: {
  regions: { id: string; name: string }[];
  onDone: () => void;
}): React.JSX.Element {
  const { session } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [regionQuery, setRegionQuery] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const action = useAction(onDone);
  const set = (key: keyof typeof EMPTY) => (text: string) =>
    setForm((f) => ({ ...f, [key]: text }));

  const region = regions.find((r) => r.id === regionId);
  const q = regionQuery.trim().toLowerCase();
  const matches = q ? regions.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6) : [];

  async function submit(): Promise<void> {
    if (!regionId || form.shopName.trim().length < 2 || !session) return;
    const ok = await action.run(() =>
      createVendor(supabase, {
        shop_name: form.shopName.trim(),
        owner_name: orNull(form.ownerName),
        town: orNull(form.town),
        phone: orNull(form.phone),
        whatsapp: orNull(form.whatsapp),
        payment_method: orNull(form.paymentMethod),
        payment_reference: orNull(form.paymentReference),
        notes: orNull(form.notes),
        region_id: regionId,
        status: 'active',
        onboarded_at: new Date().toISOString(),
        onboarded_by: session.user.id,
      }),
    );
    if (ok) {
      setForm(EMPTY);
      setRegionId(null);
      setRegionQuery('');
    }
  }

  return (
    <>
      <Heading>Add a shop</Heading>
      <Field label="Shop name" value={form.shopName} onChangeText={set('shopName')} />
      <Field label="Owner" value={form.ownerName} onChangeText={set('ownerName')} />
      <Field
        label={region ? `Region: ${region.name}` : 'Region (type to search)'}
        value={regionQuery}
        onChangeText={setRegionQuery}
        autoCorrect={false}
      />
      {matches.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {matches.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setRegionId(r.id);
                setRegionQuery('');
              }}
              className="border-line min-h-11 justify-center rounded-sm border px-3"
            >
              <Text className="text-ink text-sm">{r.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Town" value={form.town} onChangeText={set('town')} />
      <Field
        label="Phone"
        value={form.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
      />
      <Field
        label="WhatsApp"
        value={form.whatsapp}
        onChangeText={set('whatsapp')}
        keyboardType="phone-pad"
      />
      <Field
        label="Payment method"
        placeholder="UPI / bank"
        value={form.paymentMethod}
        onChangeText={set('paymentMethod')}
      />
      <Field
        label="Payment reference"
        value={form.paymentReference}
        onChangeText={set('paymentReference')}
        autoCapitalize="none"
      />
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} multiline />
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      <Button
        label="Add shop"
        onPress={() => void submit()}
        disabled={action.busy || !regionId || form.shopName.trim().length < 2}
      />
    </>
  );
}

import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createVendor, updateVendor } from '@repo/db/admin';

import { takePhotos, type ListingPhoto } from './listing-photos';
import { AdminButton, Sheet } from './ui';
import { useAction } from './use-action';

import { ErrorText, Field } from '@/components/ui';
import { sniff } from '@/lib/photo-files';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const EMPTY = { shopName: '', ownerName: '', town: '', phone: '', whatsapp: '', paymentMethod: '', paymentReference: '', notes: '' };
const orNull = (v: string) => v.trim() || null;

/** A shop photo in the private `vendor-docs` bucket (admin only, D-003): never on a customer surface. */
async function uploadShopPhoto(vendorId: string, photo: ListingPhoto): Promise<string> {
  const body = await (await fetch(photo.uri)).arrayBuffer();
  const { type, ext } = sniff(body);
  const path = `${vendorId}/shop-${Date.now().toString(36)}.${ext}`;
  const { error } = await supabase.storage.from('vendor-docs').upload(path, body, { contentType: type });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Add a vendor in about a minute (D-097, admin.md §Vendors): a sheet with the shop's name, owner, phone and WhatsApp,
 * state and town, how it is paid, and a photo of the shop. Everything can be edited later on the web panel.
 */
export function AddVendorSheet({
  open,
  regions,
  onClose,
  onDone,
}: {
  open: boolean;
  regions: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => void;
}): React.JSX.Element {
  const { session } = useSession();
  const [form, setForm] = useState(EMPTY);
  const [regionQuery, setRegionQuery] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ListingPhoto | null>(null);
  const action = useAction();
  const set = (key: keyof typeof EMPTY) => (text: string) => setForm((f) => ({ ...f, [key]: text }));
  const region = regions.find((r) => r.id === regionId);
  const q = regionQuery.trim().toLowerCase();
  const matches = q ? regions.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 6) : [];

  async function submit(): Promise<void> {
    if (!regionId || form.shopName.trim().length < 2 || !session) return;
    const ok = await action.run(async () => {
      const { id } = await createVendor(supabase, {
        shop_name: form.shopName.trim(),
        owner_name: orNull(form.ownerName),
        town: orNull(form.town),
        phone: orNull(form.phone),
        whatsapp: orNull(form.whatsapp) ?? orNull(form.phone),
        payment_method: orNull(form.paymentMethod),
        payment_reference: orNull(form.paymentReference),
        notes: orNull(form.notes),
        region_id: regionId,
        status: 'active',
        onboarded_at: new Date().toISOString(),
        onboarded_by: session.user.id,
      });
      if (photo) await updateVendor(supabase, id, { photo_path: await uploadShopPhoto(id, photo) });
    });
    if (ok) {
      setForm(EMPTY);
      setRegionId(null);
      setRegionQuery('');
      setPhoto(null);
      onDone();
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a vendor">
      <Text className="font-body text-ink-muted text-[14px]">About a minute; everything can be edited later.</Text>
      <Field label="Shop name" value={form.shopName} onChangeText={set('shopName')} placeholder="e.g. Kasavu House" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Owner" value={form.ownerName} onChangeText={set('ownerName')} />
        </View>
        <View className="flex-1">
          <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="+91 …" />
        </View>
      </View>
      <Field label="WhatsApp (if not the phone)" value={form.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
      <Field label={region ? `State: ${region.name}` : 'State (type to search)'} value={regionQuery} onChangeText={setRegionQuery} autoCorrect={false} />
      {matches.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {matches.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setRegionId(r.id);
                setRegionQuery('');
              }}
              accessibilityRole="button"
              className="border-line bg-paper min-h-10 justify-center rounded-pill border px-3.5"
            >
              <Text className="font-ui text-ink text-[14px]">{r.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Town" value={form.town} onChangeText={set('town')} />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field label="Paid by" placeholder="UPI / bank" value={form.paymentMethod} onChangeText={set('paymentMethod')} />
        </View>
        <View className="flex-1">
          <Field label="UPI id / account" value={form.paymentReference} onChangeText={set('paymentReference')} autoCapitalize="none" />
        </View>
      </View>
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} multiline />
      {photo ? (
        <View className="bg-land h-24 w-24 overflow-hidden rounded-xl">
          <Image source={photo.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        </View>
      ) : null}
      <AdminButton
        big
        kind="secondary"
        icon="camera-outline"
        label={photo ? 'Take the shop photo again' : 'Shop photo'}
        onPress={() =>
          void takePhotos('camera').then((r) => {
            if (r !== 'denied' && r[0]) setPhoto(r[0]);
          })
        }
      />
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      <AdminButton big label={action.busy ? 'Saving…' : 'Save vendor'} onPress={() => void submit()} disabled={action.busy || !regionId || form.shopName.trim().length < 2} />
    </Sheet>
  );
}

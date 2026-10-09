import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { listRegionsAdmin, listVendors } from '@repo/db/admin';

import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { AdminButton, Chip } from '@/features/admin/ui';
import { AddVendorSheet } from '@/features/admin/vendor-form';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Vendors (D-097, India desk): the shops IWC buys from, with their photo, town and state; a tap calls the shop. "Add a
 * vendor" opens a sheet. Admin-only data (D-003): shop photos come from the private bucket through short-lived links.
 */
export default function AdminVendorsScreen(): React.JSX.Element {
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useQuery('admin:vendors', async () => {
    const [vendors, regions] = await Promise.all([listVendors(supabase), listRegionsAdmin(supabase)]);
    const paths = vendors.flatMap((v) => (v.photo_path ? [v.photo_path] : []));
    const signed = paths.length ? (await supabase.storage.from('vendor-docs').createSignedUrls(paths, 3600)).data ?? [] : [];
    const photo = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
    return {
      vendors: vendors.map((v) => ({ ...v, photoUrl: v.photo_path ? (photo.get(v.photo_path) ?? null) : null })),
      regions: regions.map((r) => ({ id: r.id, name: r.name })),
    };
  });

  return (
    <Screen title="Vendors" refreshing={loading} onRefresh={reload}>
      <AdminButton big icon="add" label="Add a vendor" onPress={() => setAdding(true)} />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.vendors.length === 0 ? <Body muted>No shops yet.</Body> : null}
      <View>
        {data?.vendors.map((v) => {
          const phone = (v.phone ?? v.whatsapp ?? '').replace(/[^\d+]/g, '');
          return (
            <Pressable
              key={v.id}
              onPress={phone ? () => void Linking.openURL(`tel:${phone}`) : undefined}
              accessibilityRole={phone ? 'button' : undefined}
              accessibilityHint={phone ? 'Calls the shop' : undefined}
              className="border-line flex-row items-center gap-3 border-b py-2.5"
            >
              <View className="bg-land h-11 w-11 overflow-hidden rounded-xl">
                {v.photoUrl ? <Image source={v.photoUrl} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="font-ui-semibold text-ink text-[14px]">{v.shop_name}</Text>
                <Text numberOfLines={1} className="font-body text-ink-muted text-[13px]">
                  {[v.town, v.region?.name, v.phone ?? v.whatsapp].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View>
                {v.is_placeholder ? <Chip tone="mute">Demo</Chip> : <Chip tone={v.status === 'active' ? 'ok' : 'warn'}>{v.status === 'active' ? 'Active' : v.status === 'paused' ? 'Paused' : 'Prospect'}</Chip>}
              </View>
            </Pressable>
          );
        })}
      </View>
      {data ? <AddVendorSheet open={adding} regions={data.regions} onClose={() => setAdding(false)} onDone={() => (setAdding(false), reload())} /> : null}
    </Screen>
  );
}

import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { vendorKeepReady } from '@repo/db/vendor';
import { shortDate } from '@repo/shared/vendor';

import { Body, ErrorText, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { mediaUrl, supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Keep ready (D-102): ordered pieces IWC will collect: piece, size, how many, from when. Never who bought them. */
export default function KeepReadyScreen(): React.JSX.Element {
  const { w, lang } = useVendor();
  const { data, error, loading, reload } = useQuery('vendor:ready', () => vendorKeepReady(supabase));
  return (
    <Screen back={false} title={w('keep_ready')} refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {data && data.length === 0 ? <Body>{w('nothing_ready')}</Body> : null}
      {data?.map((r) => (
        <View key={`${r.product_id}-${r.variant_label}-${r.collect_after ?? 'now'}`} className="border-line bg-paper flex-row items-center gap-3 rounded-lg border p-2.5">
          <View className="bg-surface h-20 w-16 overflow-hidden rounded-md">
            {r.photo_path ? <Image source={{ uri: mediaUrl(r.photo_path) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
          </View>
          <View className="flex-1">
            <Text className="font-ui text-ink text-[16px]" numberOfLines={1}>{r.product_name}</Text>
            <Text className="font-body text-ink-muted text-[14px]">{r.variant_label}</Text>
            <Text className="font-body text-ink text-[14px]">{r.collect_after ? w('collect_after', { date: shortDate(r.collect_after, lang) }) : w('collect_soon')}</Text>
          </View>
          <View className="bg-brand h-12 min-w-12 items-center justify-center rounded-pill px-2">
            <Text className="font-ui text-on-brand text-[20px]">{r.quantity}</Text>
          </View>
        </View>
      ))}
    </Screen>
  );
}

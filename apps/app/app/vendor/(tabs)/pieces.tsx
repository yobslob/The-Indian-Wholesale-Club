import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { vendorPieces } from '@repo/db/vendor';
import { pieceStatus, TONE_CLASS } from '@repo/shared/vendor';

import { Body, ErrorText, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { mediaUrl, supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** My pieces (D-103): what the shop sent and what is in the store, newest first, with photo and state. */
export default function PiecesScreen(): React.JSX.Element {
  const router = useRouter();
  const { w } = useVendor();
  const { data, error, loading, reload } = useQuery('vendor:pieces', async () => {
    const { items } = await vendorPieces(supabase, 0, 50);
    const own = items.filter((p) => p.photo_bucket === 'vendor-uploads' && p.photo_path).map((p) => p.photo_path as string);
    const signed = own.length ? (await supabase.storage.from('vendor-uploads').createSignedUrls(own, 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    return items.map((p) => ({ ...p, url: !p.photo_path ? null : p.photo_bucket === 'product-media' ? mediaUrl(p.photo_path) : (urls.get(p.photo_path) ?? null) }));
  });
  return (
    <Screen back={false} title={w('my_pieces')} refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {data && data.length === 0 ? <Body>{w('no_pieces')}</Body> : null}
      {data?.map((p) => {
        const status = pieceStatus(p.kind, p.status);
        return (
          <Pressable key={`${p.kind}-${p.id}`} disabled={p.kind !== 'submission'} accessibilityRole="button" onPress={() => router.push(`/vendor/piece/${p.id}`)} className="border-line bg-paper flex-row items-center gap-3 rounded-lg border p-2.5">
            <View className="bg-surface h-20 w-16 overflow-hidden rounded-md">{p.url ? <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}</View>
            <View className="flex-1 gap-1">
              <Text className="font-ui text-ink text-[16px]" numberOfLines={1}>{p.name ?? p.category ?? '—'}</Text>
              <Text className={`font-ui self-start rounded-pill px-2.5 py-0.5 text-[13px] ${TONE_CLASS[status.tone]}`}>{w(status.key)}</Text>
              {p.pieces_left !== null ? <Text className="font-body text-ink-muted text-[13px]">{w('pieces_left', { n: p.pieces_left })}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

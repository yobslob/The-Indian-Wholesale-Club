import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { vendorCategories, vendorSubmission } from '@repo/db/vendor';
import { pieceStatus, TONE_CLASS, type Wears } from '@repo/shared/vendor';

import { ErrorText, Loading, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { NewPiece } from '@/features/vendor/new-piece';
import { mediaUrl, supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const VIEWS = ['front', 'back', 'closeup'] as const;

/** One piece the shop sent (D-103): its state and photos; when IWC asked for new photos, the same steps to retake. */
export default function PieceScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { w } = useVendor();
  const { data, error } = useQuery(`vendor:piece:${id}`, async () => {
    const piece = await vendorSubmission(supabase, id);
    if (!piece) return null;
    const paths = VIEWS.map((v) => piece.photos[v]).filter((p): p is string => Boolean(p));
    const signed = paths.length ? (await supabase.storage.from('vendor-uploads').createSignedUrls(paths, 3600)).data ?? [] : [];
    const urls = new Map(signed.map((s) => [s.path, s.signedUrl]));
    const [categories, account] = await Promise.all([vendorCategories(supabase), supabase.from('vendor_accounts').select('vendor_id').maybeSingle()]);
    return { piece, urls, categories, vendorId: account.data?.vendor_id ?? null };
  });
  if (error) return <Screen><ErrorText>{error}</ErrorText></Screen>;
  if (!data) return <Screen><Loading /></Screen>;
  const { piece, urls, categories, vendorId } = data;
  const photo = (v: (typeof VIEWS)[number]): string | undefined => urls.get(piece.photos[v] ?? '') ?? undefined;
  const status = pieceStatus('submission', piece.status);
  const category = categories.find((c) => c.id === piece.category_id);

  if ((piece.status === 'needs_retake' || piece.status === 'adding') && category && vendorId) {
    return (
      <Screen title={w('take_new_photos')}>
        {piece.retake_reason ? <ErrorText>{w(`reason_${piece.retake_reason}`)}</ErrorText> : null}
        <NewPiece
          vendorId={vendorId}
          categories={categories}
          existing={{
            id: piece.id,
            category,
            wears: (piece.details.wears as Wears | undefined) ?? null,
            photos: { front: photo('front'), back: photo('back'), closeup: photo('closeup') },
            details: {
              sizes: piece.variants,
              price: piece.shop_price_paise ? String(Math.round(piece.shop_price_paise / 100)) : '',
              fabric: piece.details.fabric ?? '',
              care: piece.details.care ?? '',
              colour: piece.details.colour ?? '',
              note: piece.details.note ?? '',
            },
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen title={piece.product?.name ?? w('my_pieces')}>
      <Text className={`font-ui self-start rounded-pill px-3 py-1 text-[15px] ${TONE_CLASS[status.tone]}`}>{w(status.key)}</Text>
      {piece.product?.photo_path ? (
        <View className="gap-1">
          <Image source={{ uri: mediaUrl(piece.product.photo_path) }} style={{ width: '100%', height: 420, borderRadius: 14 }} contentFit="contain" />
          <Text className="font-body text-ink-muted text-center text-[14px]">{w('in_store_photo')}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2">
        {VIEWS.map((v) => (
          <View key={v} className="bg-surface aspect-[3/4] flex-1 overflow-hidden rounded-md">
            {photo(v) ? <Image source={{ uri: photo(v) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

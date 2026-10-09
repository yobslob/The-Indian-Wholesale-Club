import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { getAdminProduct, setProductStatus } from '@repo/db/admin';
import { PRODUCT_STATUS } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { rupees } from '@/features/admin/format';
import { listingNeeds } from '@/features/admin/listing-needs';
import { QtyConfirm } from '@/features/admin/qty-confirm';
import { AdminButton, Chip, Panel, StatusChip } from '@/features/admin/ui';
import { useAction } from '@/features/admin/use-action';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * One listing (D-097): its photos, price and what it still needs; Publish, Pause or Back on sale; each option's pieces
 * confirmed with the shop. Its words are edited on the web panel.
 */
export default function AdminListingScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, error, loading, reload } = useQuery(`admin:listing:${id}`, () => getAdminProduct(supabase, id));
  const action = useAction(reload);

  if (!p) {
    return (
      <Screen title="Listing" refreshing={loading} onRefresh={reload}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading ? <Loading /> : <Body muted>Listing not found.</Body>}
      </Screen>
    );
  }
  const photos = p.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const [need, tone] = listingNeeds(p);
  const set = (status: 'live' | 'paused') => () => void action.run(() => setProductStatus(supabase, p.id, status));

  return (
    <Screen title="Listing" refreshing={loading} onRefresh={reload}>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
          {photos.map((m) => (
            <View key={m.id} className="bg-land h-[160px] w-[120px] overflow-hidden rounded-[10px]">
              <Photo path={m.storage_path} width={120} accessibilityLabel={m.alt_text} />
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View className="gap-2">
        <Text accessibilityRole="header" className="font-heading-semibold text-ink text-[22px] leading-7">
          {p.name}
        </Text>
        <View className="flex-row flex-wrap gap-1.5">
          <StatusChip map={PRODUCT_STATUS} status={p.status} />
          {p.status === 'draft' ? <Chip tone={tone}>{need}</Chip> : null}
        </View>
        <Text className="font-body text-ink-muted text-[13px]">
          {formatUsd(p.price_cents)}
          {p.price_auto ? ' (automatic)' : ' (by hand)'} · shop price {rupees(p.shop_price_paise)}
        </Text>
      </View>
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      {p.status === 'draft' && p.product_type === 'clothing' ? (
        <AdminButton big label="Publish" disabled={action.busy || need !== 'Ready to publish'} onPress={set('live')} />
      ) : null}
      {p.status === 'live' ? <AdminButton big kind="secondary" label="Pause (take off sale)" disabled={action.busy} onPress={set('paused')} /> : null}
      {p.status === 'paused' ? <AdminButton big label="Back on sale" disabled={action.busy} onPress={set('live')} /> : null}
      <Panel title="Pieces at the shop">
        {p.variants.filter((v) => v.is_active).length === 0 ? <Body muted>No options yet.</Body> : null}
        {p.variants
          .filter((v) => v.is_active)
          .map((v) => (
            <QtyConfirm key={`${v.id}:${v.qty_listed}:${v.qty_confirmed_at ?? ''}`} variant={v} onDone={reload} />
          ))}
      </Panel>
      <Body muted>Its name, story and details are edited on the web panel.</Body>
    </Screen>
  );
}

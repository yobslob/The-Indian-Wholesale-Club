import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { countProductsByStatus, listAdminProducts } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Photo } from '@/components/photo';
import { Body, Button, ErrorText, Loading, Screen } from '@/components/ui';
import { listingNeeds } from '@/features/admin/listing-needs';
import { AdminButton, AdminHead, Chip } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

const VIEWS: { key: Enum<'product_status'>; label: string }[] = [
  { key: 'draft', label: 'Drafts' },
  { key: 'live', label: 'Live' },
  { key: 'paused', label: 'Paused' },
];

/**
 * Listings (D-097, India desk): New (the camera or many from the gallery) and Add many, then Drafts / Live / Paused
 * with counts, 50 at a time. A draft's card says what it still needs; opening a listing publishes it, pauses it and
 * confirms its pieces with the shop. Editing a listing's words stays on the web panel.
 */
export default function AdminListingsScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const status = VIEWS.find((v) => v.key === params.view)?.key ?? 'draft';
  const { data: counts, reload: reloadCounts } = useQuery('admin:listing-counts', () => countProductsByStatus(supabase));
  const { items, error, loading, loadingMore, hasMore, loadMore, reload } = usePagedQuery(
    `admin:listings:${status}`,
    (offset, limit) => listAdminProducts(supabase, { status, offset, limit }),
    50,
  );

  return (
    <Screen
      back={false}
      refreshing={loading}
      onRefresh={() => {
        reload();
        reloadCounts();
      }}
    >
      <AdminHead title="Listings" />
      <View className="-mt-2 flex-row gap-2">
        <View className="flex-1">
          <AdminButton big icon="camera-outline" label="New listing" onPress={() => router.push('/admin/listing/new')} />
        </View>
        <View className="flex-1">
          <AdminButton big kind="secondary" icon="images-outline" label="Add many" onPress={() => router.push('/admin/listing/many')} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 -mt-2" contentContainerClassName="gap-1.5 px-4">
        {VIEWS.map((v) => {
          const on = v.key === status;
          return (
            <Pressable
              key={v.key}
              onPress={() => router.setParams({ view: v.key })}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              className={`h-9 flex-row items-center gap-1.5 rounded-pill border px-3 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
            >
              <Text className={`font-ui text-[13px] ${on ? 'text-paper' : 'text-ink'}`}>{v.label}</Text>
              {counts ? <Text className={`font-ui-semibold text-[13px] ${on ? 'text-[rgba(251,248,243,0.7)]' : 'text-ink-muted'}`}>{counts[v.key]}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!items && loading ? <Loading /> : null}
      {items && items.length === 0 ? <Body muted>Nothing here.</Body> : null}
      <View className="-mt-2 gap-2">
        {items?.map((p) => {
          const main = p.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          const [need, tone] = listingNeeds(p);
          const pieces = p.variants.filter((v) => v.is_active).reduce((n, v) => n + v.qty_listed, 0);
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/admin/listing/[id]', params: { id: p.id } })}
              accessibilityRole="button"
              className="border-line bg-paper flex-row gap-3 rounded-[14px] border p-3"
            >
              <View className="bg-land h-[58px] w-11 overflow-hidden rounded-lg">{main ? <Photo path={main.storage_path} width={44} /> : null}</View>
              <View className="min-w-0 flex-1 gap-1">
                <Text numberOfLines={1} className="font-ui-semibold text-ink text-[14px]">
                  {p.name}
                </Text>
                <Text numberOfLines={1} className="font-body text-ink-muted text-[12.5px]">
                  {[p.region?.name, p.vendor?.shop_name, `${pieces} piece${pieces === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </Text>
                {status === 'draft' ? <Chip tone={tone}>{need}</Chip> : null}
              </View>
              <Text className="font-ui-semibold text-ink text-[14px]">{formatUsd(p.price_cents)}</Text>
            </Pressable>
          );
        })}
      </View>
      {hasMore ? <Button kind="secondary" label={loadingMore ? 'Loading…' : 'Show more'} disabled={loadingMore} onPress={loadMore} /> : null}
    </Screen>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { browseProducts, type BrowsePage, type ProductCard as ProductCardData } from '@repo/db/store';
import tokens from '@repo/tokens';

import { BackBar, Body, ErrorText, Loading, Title } from '@/components/ui';
import { ProductCard } from '@/features/catalog/cards';
import { FilterPanel } from '@/features/catalog/filter-panel';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';

const slugOrNothing = (v: unknown): string | undefined =>
  typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined;
/** Scrolled this far, the Filter bar has gone under the back bar: the round button takes its place (D-084). */
const STUCK_AT = 120;

/**
 * Browse: the "See all" screen behind every row (D-062, D-084, D-095). Every live product of one type, newest first,
 * narrowed by state and category through the Filter bar (what is chosen and the count), which shrinks to a round icon
 * button once the list is scrolled; both open the Filter panel. Loaded 24 at a time as the list nears its end
 * (store_browse: the page, the total and the filter counts in one round trip), in a virtualized two-column grid.
 */
export default function BrowseScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type === 'spice' ? 'spice' : 'clothing';
  const region = slugOrNothing(params.region);
  const category = slugOrNothing(params.category);
  const key = `browse:${type}:${region ?? ''}:${category ?? ''}`;
  const [meta, setMeta] = useState<Omit<BrowsePage, 'products'> | null>(null);
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const { items: data, error, loading, loadingMore, loadMore, reload } = usePagedQuery(key, async (offset, limit) => {
    const page = await browseProducts(supabase, { productType: type, regionSlug: region, categorySlug: category, offset, limit });
    if (offset === 0) setMeta({ total: page.total, regions: page.regions, categories: page.categories });
    return page.products;
  });
  const renderItem = useCallback(({ item }: { item: ProductCardData }) => <ProductCard product={item} layout="fill" />, []);
  const stateName = meta?.regions.find((r) => r.slug === region)?.name;
  const categoryName = meta?.categories.find((c) => c.slug === category)?.name;
  const title = categoryName ?? (type === 'clothing' ? 'Clothing' : 'Spices');
  const count = meta ? `${meta.total} ${meta.total === 1 ? 'piece' : 'pieces'}` : '';
  const chosen = `${stateName ?? 'All states'} · ${categoryName ?? 'Everything'}`;
  const allCount = meta?.regions.reduce((n, r) => n + r.count, 0);

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      <BackBar title={title} />
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        renderItem={renderItem}
        columnWrapperClassName="gap-3"
        contentContainerClassName="gap-6 px-4 pb-16 pt-4"
        refreshing={loading}
        onRefresh={reload}
        initialNumToRender={6}
        windowSize={7}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        onScroll={(e) => setStuck(e.nativeEvent.contentOffset.y > STUCK_AT)}
        scrollEventThrottle={64}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={tokens.colors.ink} /> : null}
        ListHeaderComponent={
          <View className="gap-3">
            <Title>
              {title}
              {stateName ? <Text className="text-ink-muted"> · {stateName}</Text> : null}
            </Title>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${chosen}, ${count}`}
                onPress={() => setOpen(true)}
                className="bg-ink min-h-11 flex-row items-center gap-2 rounded-pill px-[18px]"
              >
                <Ionicons name="options-outline" size={18} color={tokens.colors.paper} />
                <Text className="font-ui-semibold text-paper text-sm">Filter</Text>
              </Pressable>
              <View className="flex-1">
                <Text numberOfLines={1} className="font-ui text-ink text-sm">
                  {chosen}
                </Text>
                <Text className="font-ui text-ink-muted text-xs">{count}</Text>
              </View>
            </View>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {!data && loading ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={data ? <Body muted>Nothing here yet.</Body> : null}
        style={{ backgroundColor: tokens.colors.canvas }}
      />
      {stuck ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Filter: ${chosen}, ${count}`}
          onPress={() => setOpen(true)}
          style={{ top: 56, shadowColor: '#14110F', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 }}
          className="bg-ink absolute left-4 h-12 w-12 items-center justify-center rounded-full"
        >
          <Ionicons name="options-outline" size={20} color={tokens.colors.paper} />
        </Pressable>
      ) : null}
      <FilterPanel
        open={open}
        onClose={() => setOpen(false)}
        states={[{ slug: undefined, name: 'All states', count: allCount }, ...(meta?.regions ?? [])]}
        categories={[{ slug: undefined, name: 'Everything' }, ...(meta?.categories ?? [])]}
        state={region}
        category={category}
        onPick={(next) => router.setParams({ region: next.region ?? '', category: next.category ?? '' })}
      />
    </SafeAreaView>
  );
}

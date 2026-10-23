import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getQuickFront, getQuickPage, type ProductCard as ProductCardData, type QuickPage } from '@repo/db/store';
import { formatUsd, quickArrivesLine } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { BackBar, Body, ErrorText, Loading } from '@/components/ui';
import { ProductCard } from '@/features/catalog/cards';
import { ProductRow } from '@/features/catalog/product-row';
import { quickDaysLabel } from '@/features/seven-day/days';
import { StoreSwitch } from '@/features/seven-day/store-switch';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

type Meta = Pick<QuickPage, 'days_min' | 'days_max' | 'all_total' | 'categories'>;

/** A pill, filled when chosen (the website's 7-day pills). */
function Pill({ label, count, chosen, onPress }: { label: string; count: number; chosen: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      onPress={onPress}
      className={`min-h-11 flex-row items-center gap-2 rounded-pill border px-5 ${chosen ? 'bg-ink border-ink' : 'bg-paper border-line'}`}
    >
      <Text className={`font-ui-semibold text-sm ${chosen ? 'text-canvas' : 'text-ink'}`}>
        {label} <Text className="opacity-60">{count}</Text>
      </Text>
    </Pressable>
  );
}

/**
 * 7-day delivery (D-148): every piece that reaches the customer in the 7-day days (Settings), as on the website's
 * /7-day-delivery. A header with the days, category pills (All and each category, biggest first) and a two-column grid
 * loaded 24 at a time (store_quick_browse: the page, the counts and the days in one round trip). The days come only
 * from Settings (non-negotiable 4); with them empty the screen has nothing to show. Which shop makes a piece 7-day
 * never reaches the app (D-003). D-154: the 7-day store's front page, as on the website: the store switch, "Order
 * today, arrives by Fri, Oct 30", the rows Most ordered this week, Under $5 and New this week (store_quick_front), then
 * every piece. The words are the plan's, approved 2026-10-23.
 */
/** Every card here is a 7-day piece: the screen says so once, not on each card. */
const untagged = (cards: ProductCardData[]): ProductCardData[] => cards.map((p) => ({ ...p, quick_days: null }));

export default function SevenDayScreen(): React.JSX.Element {
  const [category, setCategory] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const { items: data, error, loading, loadingMore, loadMore, reload } = usePagedQuery(`quick:${category ?? ''}`, async (offset, limit) => {
    const page = await getQuickPage(supabase, { category, offset, limit });
    if (offset === 0) setMeta({ days_min: page.days_min, days_max: page.days_max, all_total: page.all_total, categories: page.categories });
    return page.products;
  });
  const front = useQuery('quick-front', () => getQuickFront(supabase));
  // every card here is a 7-day piece: the header says so once, not each card
  const renderItem = useCallback(
    ({ item }: { item: ProductCardData }) => <ProductCard product={{ ...item, quick_days: null }} layout="fill" />,
    [],
  );
  // null until the first page arrives, and while 7-day delivery is off (no days in Settings)
  const days = meta && meta.days_min !== null && meta.days_max !== null ? quickDaysLabel(meta.days_min, meta.days_max) : null;

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      <BackBar title={days ? `${days}-day delivery` : ''} />
      <FlatList
        data={days ? (data ?? []) : []}
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
        ListFooterComponent={loadingMore ? <ActivityIndicator color={tokens.colors.ink} /> : null}
        ListHeaderComponent={
          <View className="gap-5">
            {front.data ? <StoreSwitch store="quick" daysMin={front.data.days_min} daysMax={front.data.days_max} /> : null}
            {meta && days ? (
              <View className="border-line bg-paper gap-4 overflow-hidden rounded-[18px] border px-5 py-9">
                <Text className="font-ui-semibold text-brand text-xs uppercase tracking-[2px]">{days}-day delivery</Text>
                <Text accessibilityRole="header" className="font-display text-ink text-[40px] leading-[42px]">
                  Home, in {days} days.
                </Text>
                {front.data ? (
                  <Text className="font-heading text-ink text-xl">
                    Order today, {quickArrivesLine(front.data.days_min, front.data.days_max)}.
                  </Text>
                ) : null}
                <Body muted>
                  The snacks, masalas and sweets you grew up with.
                  {front.data?.min_cents ? ` Comes in ${days} days with ${formatUsd(front.data.min_cents)} of 7-day pieces.` : ''}
                </Body>
                {/* the brand's running stitch (storefront.md §Visual system 8), a still thread under the words; a whole
                    dashed border, as Android draws no dashes on one side alone */}
                <View className="border-brand/60 h-0 w-[70%] border border-dashed" />
                <Text className="font-ui-semibold text-ink text-sm">
                  {meta.all_total} {meta.all_total === 1 ? 'piece' : 'pieces'}
                </Text>
              </View>
            ) : null}
            {front.data && category === null ? (
              <>
                <ProductRow title="Most ordered this week" products={untagged(front.data.most_ordered)} />
                <ProductRow title="Under $5" products={untagged(front.data.under_5)} />
                <ProductRow title="New this week" products={untagged(front.data.new_this_week)} />
              </>
            ) : null}
            {meta && days && meta.all_total > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
                <Pill label="All" count={meta.all_total} chosen={category === null} onPress={() => setCategory(null)} />
                {meta.categories.map((c) => (
                  <Pill key={c.slug} label={c.name} count={c.count} chosen={category === c.slug} onPress={() => setCategory(c.slug)} />
                ))}
              </ScrollView>
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            {!data && loading ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={meta && !loading ? <Body muted>Nothing here right now. Look again soon.</Body> : null}
        style={{ backgroundColor: tokens.colors.canvas }}
      />
    </SafeAreaView>
  );
}

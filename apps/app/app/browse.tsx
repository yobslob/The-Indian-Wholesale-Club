import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countProducts, listProducts } from '@repo/db/store';
import tokens from '@repo/tokens';

import { Body, ErrorText, Loading, Title } from '@/components/ui';
import { ProductCard } from '@/features/catalog/cards';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

const slugOrNothing = (v: unknown): string | undefined =>
  typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined;

/**
 * Browse: the "See all" screen behind every row (D-062). Every live product of one type, newest first, narrowed by
 * region and category. Loaded 24 at a time as the list nears its end, in a virtualized two-column grid, so a long
 * list is never downloaded or drawn at once.
 */
export default function BrowseScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params.type === 'spice' ? 'spice' : 'clothing';
  const region = slugOrNothing(params.region);
  const category = slugOrNothing(params.category);
  const filter = { productType: type, regionSlug: region, categorySlug: category } as const;
  const key = `browse:${type}:${region ?? ''}:${category ?? ''}`;
  const { items: data, error, loading, loadingMore, loadMore, reload } = usePagedQuery(key, (offset, limit) =>
    listProducts(supabase, { ...filter, sort: 'newest', offset, limit }),
  );
  const total = useQuery(`${key}:count`, () => countProducts(supabase, filter)).data;
  const first = data?.[0];
  const title = (category && first?.category_name) || (type === 'clothing' ? 'Clothing' : 'Spices');

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        renderItem={({ item }) => <ProductCard product={item} layout="fill" />}
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
          <View className="gap-2">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="-ml-1 min-h-11 flex-row items-center gap-1 self-start pr-3"
            >
              <Text className="font-ui text-ink text-sm">‹ Back</Text>
            </Pressable>
            <Title>{title}</Title>
            {region && first ? <Body muted>From {first.region_name}</Body> : null}
            {total !== undefined ? <Body muted>{`${total} ${total === 1 ? 'piece' : 'pieces'}`}</Body> : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
            {!data && loading ? <Loading /> : null}
          </View>
        }
        ListEmptyComponent={data ? <Body muted>Nothing here yet.</Body> : null}
        style={{ backgroundColor: tokens.colors.canvas }}
      />
    </SafeAreaView>
  );
}

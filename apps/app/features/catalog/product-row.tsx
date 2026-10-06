import { useRouter } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { ProductCard } from './cards';

import type { ProductCard as ProductCardData, RegionProductCard } from '@repo/db/store';

import { Body, Heading } from '@/components/ui';

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

/** Where "See all" goes: the Browse screen for one type, narrowed by region and category (D-062). */
export interface BrowseTarget {
  type: 'clothing' | 'spice';
  region?: string;
  category?: string;
}

export function SeeAll({ target, label }: { target: BrowseTarget; label: string }): React.JSX.Element {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`See all ${label}`}
      onPress={() => router.push({ pathname: '/browse', params: { ...target } })}
      className="border-line bg-paper min-h-11 justify-center rounded-pill border px-4"
    >
      <Text className="font-ui text-ink text-[13px]">See all</Text>
    </Pressable>
  );
}

/** A row card's width (164, cards.tsx) plus the gap between cards (12). */
const ROW_STEP = 176;

/**
 * Cards in a row that scrolls sideways (D-062). A FlatList, so only the cards near the screen are drawn; the row
 * runs to the screen edges (the screen has a 16 px gutter).
 */
export function ProductStrip<T extends CardData>({
  products,
  badge,
}: {
  products: T[];
  badge?: (p: T) => string;
}): React.JSX.Element {
  return (
    <FlatList
      horizontal
      data={products}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <ProductCard product={item} layout="row" badge={badge?.(item)} />}
      showsHorizontalScrollIndicator={false}
      className="-mx-4"
      contentContainerClassName="gap-3 px-4"
      snapToInterval={ROW_STEP}
      // Every card is the same width, so the list never measures one to know where it is.
      getItemLayout={(_, index) => ({ length: ROW_STEP, offset: 16 + ROW_STEP * index, index })}
      decelerationRate="fast"
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      windowSize={5}
    />
  );
}

/** A titled row with See all when there is more behind it. Nothing when the list is empty. */
export function ProductRow<T extends CardData>({
  title,
  sub,
  products,
  seeAll,
  badge,
}: {
  title: string;
  sub?: string;
  products: T[];
  seeAll?: BrowseTarget;
  badge?: (p: T) => string;
}): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <View className="gap-4 pt-2">
      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1 gap-1">
          <Heading>{title}</Heading>
          {sub ? <Body muted>{sub}</Body> : null}
        </View>
        {seeAll ? <SeeAll target={seeAll} label={title} /> : null}
      </View>
      <ProductStrip products={products} badge={badge} />
    </View>
  );
}

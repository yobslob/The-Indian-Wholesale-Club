import { Link } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { formatUsd } from '@repo/shared/domain';

import type { ProductCard as ProductCardData, RegionCard as RegionCardData, RegionProductCard } from '@repo/db/store';

import { useBag } from '@/features/cart/store';
import { mediaUrl } from '@/lib/supabase';

/** Cards ease in as they appear; off when the phone asks for reduced motion (design.md §Direction). */
export const cardEntering = FadeInDown.duration(600).reduceMotion(ReduceMotion.System);

/** One of the 36 regions (D-002). The greeting shows only once approved (the store view enforces D-019). */
export function RegionCard({ region }: { region: RegionCardData }): React.JSX.Element {
  return (
    <Link href={{ pathname: '/region/[slug]', params: { slug: region.slug } }} asChild>
      <Pressable className="border-line bg-paper min-h-11 gap-1 rounded-lg border p-4">
        <Text className="font-display text-ink text-xl">{region.name}</Text>
        {region.greeting_native ? <Text className="text-ink-muted text-sm">{region.greeting_native}</Text> : null}
        {!region.is_live ? <Text className="font-ui text-ink-muted text-xs">Coming soon</Text> : null}
      </Pressable>
    </Link>
  );
}

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

/**
 * "Add" on a card: a product with one variant in stock goes straight into the bag (quick_add from store_*);
 * anything else opens the product to choose. Prices here are for display only: checkout re-prices on the server.
 */
function QuickAdd({ product }: { product: CardData }): React.JSX.Element {
  const add = useBag((s) => s.add);
  const [added, setAdded] = useState(false);
  const pill = 'border-line bg-paper min-h-10 items-center justify-center rounded-pill border px-3.5';
  if (product.available === 0) {
    return (
      <View className={pill}>
        <Text className="font-ui text-ink-muted text-[13px]">Sold out</Text>
      </View>
    );
  }
  const quick = product.quick_add;
  if (!quick) {
    return (
      <Link href={{ pathname: '/product/[region]/[slug]', params: { region: product.region_slug, slug: product.slug } }} asChild>
        <Pressable accessibilityLabel={`Choose options for ${product.name}`} className={pill}>
          <Text className="font-ui text-ink text-[13px]">Choose</Text>
        </Pressable>
      </Link>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={added ? `${product.name} added to your bag` : `Add ${product.name} to your bag`}
      className={pill}
      onPress={() => {
        add(
          {
            variantId: quick.variant_id,
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            regionSlug: product.region_slug,
            regionName: product.region_name,
            variantLabel: quick.label,
            unitPriceCents: quick.price_cents,
            imagePath: product.primary_image_path,
          },
          1,
        );
        setAdded(true);
      }}
    >
      <Text className="font-ui text-ink text-[13px]">{added ? '✓ Added' : '＋ Add'}</Text>
    </Pressable>
  );
}

/** The founder's reference card (D-050): a rounded 3 : 4 photo, name, price · region and "Add". */
export function ProductCard({ product, badge }: { product: CardData; badge?: string }): React.JSX.Element {
  return (
    <Animated.View entering={cardEntering} className="w-[48%] gap-2.5">
      <Link href={{ pathname: '/product/[region]/[slug]', params: { region: product.region_slug, slug: product.slug } }} asChild>
        <Pressable accessibilityLabel={product.name} className="bg-land aspect-[3/4] overflow-hidden rounded-[18px]">
          {product.primary_image_path ? (
            <Image source={{ uri: mediaUrl(product.primary_image_path) }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="font-ui text-ink-muted m-auto text-xs">Photo coming soon</Text>
          )}
          {badge ? (
            <View className="bg-paper absolute left-2.5 top-2.5 rounded-pill px-2.5 py-1">
              <Text className="font-ui text-ink text-[11px]">{badge}</Text>
            </View>
          ) : null}
        </Pressable>
      </Link>
      <View className="gap-2 px-1">
        <View>
          <Text numberOfLines={2} className="font-ui-semibold text-ink text-[13.5px] leading-[18px]">
            {product.name}
          </Text>
          <Text className="font-body text-ink-muted text-[12.5px]">
            {formatUsd(product.price_cents)} · {product.region_name}
          </Text>
        </View>
        <View className="flex-row">
          <QuickAdd product={product} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Two equal columns (the reference grid on a phone). */
export function Grid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="flex-row flex-wrap justify-between gap-y-6">{children}</View>;
}

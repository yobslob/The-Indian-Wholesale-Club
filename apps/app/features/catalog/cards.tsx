import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { memo, useState } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import type { ProductCard as ProductCardData, RegionProductCard } from '@repo/db/store';

import { Photo } from '@/components/photo';
import { useBag } from '@/features/cart/store';

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

/**
 * The card's + on its photo (D-080): a product with one variant in stock goes straight into the bag (quick_add from
 * store_*); anything else opens the product to choose. Prices here are for display only: checkout re-prices on the
 * server.
 */
function QuickAdd({ product }: { product: CardData }): React.JSX.Element {
  const add = useBag((s) => s.add);
  const [added, setAdded] = useState(false);
  const round = 'bg-paper border-line absolute bottom-2.5 right-2.5 h-10 w-10 items-center justify-center rounded-full border';
  if (product.available === 0) {
    return (
      <View className="bg-paper absolute bottom-2.5 right-2.5 rounded-pill px-3 py-1.5">
        <Text className="font-ui text-ink-muted text-xs">Sold out</Text>
      </View>
    );
  }
  const quick = product.quick_add;
  if (!quick) {
    return (
      <Link href={{ pathname: '/product/[region]/[slug]', params: { region: product.region_slug, slug: product.slug } }} asChild>
        <Pressable accessibilityLabel={`Choose options for ${product.name}`} className={round}>
          <Ionicons name="add" size={20} color={tokens.colors.ink} />
        </Pressable>
      </Link>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={added ? `${product.name} added to your bag` : `Add ${product.name} to your bag`}
      className={round}
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
      <Ionicons name={added ? 'checkmark' : 'add'} size={20} color={tokens.colors.ink} />
    </Pressable>
  );
}

/**
 * The founder's reference card (D-050): a rounded 3 : 4 photo with a round + on it (D-080), then the name and price ·
 * region across the card's full width. `row` is the fixed width for a sideways row (D-062); otherwise it fills half
 * the screen in a two-column grid. `corner` sits top right on the photo (Saved's heart, D-089). No entry animation:
 * dozens of cards animating at once made scrolling stutter.
 */
export const ProductCard = memo(function ProductCard({
  product,
  badge,
  layout = 'grid',
  corner,
}: {
  product: CardData;
  badge?: string;
  layout?: 'grid' | 'row' | 'fill';
  corner?: React.ReactNode;
}): React.JSX.Element {
  const width = layout === 'row' ? 'w-[164px]' : layout === 'fill' ? 'flex-1' : 'w-[48%]';
  return (
    <View className={`${width} gap-2.5`}>
      <View>
        <Link href={{ pathname: '/product/[region]/[slug]', params: { region: product.region_slug, slug: product.slug } }} asChild>
          <Pressable accessibilityLabel={product.name} className="bg-land aspect-[3/4] overflow-hidden rounded-[18px]">
            {product.primary_image_path ? (
              <Photo
                path={product.primary_image_path}
                width={layout === 'row' ? 164 : Dimensions.get('window').width / 2}
                transition={150}
                recyclingKey={product.id}
                accessibilityIgnoresInvertColors
              />
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
        <QuickAdd product={product} />
        {corner ? <View className="absolute right-2.5 top-2.5">{corner}</View> : null}
      </View>
      <View className="px-1">
        <Text numberOfLines={2} className="font-ui-semibold text-ink text-[13.5px] leading-[18px]">
          {product.name}
        </Text>
        <Text className="font-body text-ink-muted text-[12.5px]">
          {formatUsd(product.price_cents)} · {product.region_name}
        </Text>
      </View>
    </View>
  );
});

/** Two equal columns (the reference grid on a phone). */
export function Grid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="flex-row flex-wrap justify-between gap-y-6">{children}</View>;
}

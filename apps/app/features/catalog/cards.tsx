import { Link } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { formatUsd } from '@repo/shared/domain';

import type { ProductCard as ProductCardData, RegionCard as RegionCardData } from '@repo/db/store';

import { mediaUrl } from '@/lib/supabase';

/** One of the 36 regions (D-002). The greeting shows only once approved (the store view enforces D-019). */
export function RegionCard({ region }: { region: RegionCardData }): React.JSX.Element {
  return (
    <Link href={{ pathname: '/region/[slug]', params: { slug: region.slug } }} asChild>
      <Pressable
        className="border-line min-h-11 rounded-md border p-3"
        style={
          region.accent_color
            ? { borderTopColor: region.accent_color, borderTopWidth: 4 }
            : undefined
        }
      >
        <Text className="text-ink font-medium">{region.name}</Text>
        {region.greeting_native ? (
          <Text className="text-ink-muted text-sm">{region.greeting_native}</Text>
        ) : null}
        {!region.is_live ? <Text className="text-ink-muted text-xs">Coming soon</Text> : null}
      </Pressable>
    </Link>
  );
}

export function ProductCard({
  product,
  available,
}: {
  product: ProductCardData;
  available?: number;
}): React.JSX.Element {
  return (
    <Link
      href={{
        pathname: '/product/[region]/[slug]',
        params: { region: product.region_slug, slug: product.slug },
      }}
      asChild
    >
      <Pressable className="border-line w-[48%] gap-1 rounded-md border p-2">
        <View className="bg-surface aspect-[4/5] overflow-hidden rounded-sm">
          {product.primary_image_path ? (
            <Image
              source={{ uri: mediaUrl(product.primary_image_path) }}
              accessibilityLabel={product.name}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-ink-muted m-auto text-xs">Photo coming soon</Text>
          )}
        </View>
        <Text className="text-ink text-sm font-medium">{product.name}</Text>
        <Text className="text-ink-muted text-xs">{product.region_name}</Text>
        <Text className="text-ink text-sm">{formatUsd(product.price_cents)}</Text>
        {available !== undefined && available <= 0 ? (
          <Text className="text-caution text-xs">Sold out</Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

export function Grid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="flex-row flex-wrap justify-between gap-y-3">{children}</View>;
}

import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { HomeData } from '@repo/db/store';

import { Photo } from '@/components/photo';
import { Heading } from '@/components/ui';

/**
 * Shop by category (D-187), as on the website's Home: three to a row, biggest first, each with the photo of its newest
 * piece, its name and count. A tile opens that category's See all (the Browse screen).
 */
export function CategoryTiles({ categories }: { categories: HomeData['categories'] }): React.JSX.Element | null {
  const router = useRouter();
  if (categories.length < 2) return null;
  return (
    <View className="gap-4 pt-2">
      <Heading>Shop by category</Heading>
      <View className="flex-row flex-wrap justify-between gap-y-4">
        {categories.map((c) => (
          <Pressable
            key={c.for ? `${c.slug}:${c.for}` : c.slug}
            accessibilityRole="link"
            accessibilityLabel={`${c.name}, ${c.count} ${c.count === 1 ? 'piece' : 'pieces'}`}
            onPress={() =>
              router.push({
                pathname: '/browse',
                // D-190: Shirts and Tops share a category and open it for men or women
                params: { type: c.product_type, category: c.slug, ...(c.for ? { for: c.for } : {}) },
              })
            }
            className="w-[31.5%] gap-2"
          >
            <View className="bg-land aspect-square overflow-hidden rounded-lg">
              {c.image_path ? <Photo path={c.image_path} width={120} recyclingKey={c.slug} /> : null}
            </View>
            <View>
              <Text numberOfLines={2} className="font-ui-semibold text-ink text-[13px] leading-4">
                {c.name}
              </Text>
              <Text className="font-ui text-ink-muted text-xs">
                {c.count} {c.count === 1 ? 'piece' : 'pieces'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

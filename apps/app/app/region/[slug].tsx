import { Link, useLocalSearchParams } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { getRegionPage } from '@repo/db/store';

import { Photo } from '@/components/photo';
import { Body, ErrorText, Heading, Loading, Screen } from '@/components/ui';
import { CuratedCard } from '@/features/catalog/curated-card';
import { ProductRow } from '@/features/catalog/product-row';
import { RegionAlbum } from '@/features/regions/region-album';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const ROW = 12;

/**
 * The core page (storefront.md §The region page, design.md §Direction). One store_region_page() call: the
 * greeting in its own script (the phone's system fonts cover every Indian script), New arrivals, Most wanted
 * (D-058), the album (D-051), Curated for you, Leaving soon (D-056), then one row per clothing category and Spices. Every list is a
 * sideways row with See all where there is more (D-062).
 */
export default function RegionScreen(): React.JSX.Element {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, reload } = useQuery(`region:${slug}`, () => getRegionPage(supabase, slug));
  const accent = data?.region.accent_color ?? undefined;
  const products = data?.products ?? [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This page doesn&apos;t exist.</Body> : null}
      {data ? (
        <>
          <Link href="/explore" asChild>
            <Pressable className="min-h-10 justify-center">
              <Text className="font-ui text-ink-muted text-[13px]">All of India / {data.region.name}</Text>
            </Pressable>
          </Link>
          <View className="gap-1">
            {data.region.greeting_native ? (
              <Text className="text-brand text-[52px] font-light leading-[64px]" style={accent ? { color: accent } : undefined}>
                {data.region.greeting_native}
              </Text>
            ) : null}
            {data.region.greeting_latin || data.region.greeting_meaning ? (
              <Body muted>{[data.region.greeting_latin, data.region.greeting_meaning].filter(Boolean).join(' · ')}</Body>
            ) : null}
            <Text accessibilityRole="header" className="font-display text-ink mt-3 text-[52px] leading-[54px]">
              {data.region.name}
            </Text>
            {data.region.tagline ? <Body>{data.region.tagline}</Body> : null}
            {data.region.story ? <Body muted>{data.region.story}</Body> : null}
          </View>
          <View className="bg-brand aspect-[5/6] overflow-hidden rounded-lg" style={accent ? { backgroundColor: accent } : undefined}>
            {data.region.hero_image_path ? (
              <Photo
                path={data.region.hero_image_path}
                width={Dimensions.get('window').width}
                transition={200}
                accessibilityIgnoresInvertColors
              />
            ) : null}
          </View>

          {!data.region.is_live ? (
            <View className="bg-surface rounded-lg p-5">
              <Text className="font-body text-ink text-xl">
                {data.region.name} is coming soon. We are adding its clothing and spices.
              </Text>
            </View>
          ) : (
            <>
              <ProductRow
                title="New arrivals"
                sub={`Newest pieces from ${data.region.name}.`}
                products={products.slice(0, ROW)}
                seeAll={{ type: 'clothing', region: slug }}
              />
              <ProductRow
                title="Most wanted"
                sub={`Most ordered from ${data.region.name} in the last 30 days.`}
                products={data.most_wanted}
              />
              <RegionAlbum photos={data.album} />
              <CuratedCard products={data.curated} regionName={data.region.name} />
              <ProductRow
                title="Leaving soon"
                sub="Only a few pieces left of these."
                products={data.leaving_soon}
                badge={(p) => `${p.available} left`}
              />
              {/* One row per clothing category, biggest first by its real total (the page carries its first 12). */}
              {data.category_counts
                .filter((c) => c.product_type === 'clothing')
                .map((c) => ({ ...c, items: products.filter((p) => p.category_slug === c.slug) }))
                .map((c) => (
                  <ProductRow
                    key={c.slug}
                    title={c.name}
                    products={c.items.slice(0, ROW)}
                    seeAll={{ type: 'clothing', region: slug, category: c.slug }}
                  />
                ))}
              {products.some((p) => p.product_type === 'spice') ? (
                <ProductRow
                  title="Spices"
                  products={products.filter((p) => p.product_type === 'spice').slice(0, ROW)}
                  seeAll={{ type: 'spice', region: slug }}
                />
              ) : (
                <View className="gap-4 pt-2">
                  <Heading>Spices</Heading>
                  <View className="bg-surface rounded-lg p-5">
                    <Text className="font-body text-ink text-xl">Spices from {data.region.name} are coming soon.</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

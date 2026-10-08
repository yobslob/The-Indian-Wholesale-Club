import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';

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
 * The core page (storefront.md §The region page, D-081, D-095). One store_region_page() call: the photo first, then
 * the greeting in its own script (the phone's system fonts cover every Indian script), the name in Cinzel, tagline
 * and story; jump pills to each section; New arrivals, Most wanted (D-058), the album (D-051), Picked for you as a
 * row inside its box (D-081), Leaving soon (D-056), then one row per clothing category and Spices (D-062).
 */
export default function RegionScreen(): React.JSX.Element {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, reload } = useQuery(`region:${slug}`, () => getRegionPage(supabase, slug));
  const scroller = useRef<ScrollView>(null);
  // Each section's place in the scroll, for the jump pills: the column's offset plus the section's offset in it.
  const columnY = useRef(0);
  const sectionY = useRef<Record<string, number>>({});
  const accent = data?.region.accent_color ?? undefined;
  const products = data?.products ?? [];
  const width = Dimensions.get('window').width;
  const categories = (data?.category_counts ?? [])
    .filter((c) => c.product_type === 'clothing')
    .map((c) => ({ ...c, items: products.filter((p) => p.category_slug === c.slug) }));
  const spices = products.filter((p) => p.product_type === 'spice');
  const spiceCount = (data?.category_counts ?? []).filter((c) => c.product_type === 'spice').reduce((n, c) => n + c.count, 0);
  const mark = (key: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };
  const jump = (key: string): void => {
    const y = sectionY.current[key];
    if (y !== undefined) scroller.current?.scrollTo({ y: columnY.current + y - 12, animated: true });
  };
  const pills: [string, string, number | null][] = [
    ['new', 'New arrivals', null],
    ...categories.map((c): [string, string, number | null] => [`c-${c.slug}`, c.name, c.count]),
    ['spices', 'Spices', spiceCount],
  ];

  return (
    <Screen
      title={data?.region.name}
      refreshing={loading}
      onRefresh={reload}
      scrollRef={scroller}
      top={
        data ? (
          <View style={{ height: 300, backgroundColor: accent ?? undefined }} className="bg-region" onLayout={(e) => (columnY.current = e.nativeEvent.layout.height)}>
            {data.region.hero_image_path ? (
              <Photo path={data.region.hero_image_path} width={width} transition={200} accessibilityIgnoresInvertColors />
            ) : null}
          </View>
        ) : null
      }
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This page doesn&apos;t exist.</Body> : null}
      {data ? (
        <>
          <View className="gap-1 pt-1">
            {data.region.greeting_native ? (
              <Text className="text-brand text-[46px] font-light leading-[56px]" style={accent ? { color: accent } : undefined}>
                {data.region.greeting_native}
              </Text>
            ) : null}
            {data.region.greeting_latin || data.region.greeting_meaning ? (
              <Body muted>{[data.region.greeting_latin, data.region.greeting_meaning].filter(Boolean).join(' · ')}</Body>
            ) : null}
            <Text accessibilityRole="header" className="font-display mt-3 text-[52px] leading-[54px] text-[#1D1A17]">
              {data.region.name}
            </Text>
            {data.region.tagline ? <Text className="font-body text-ink mt-3 text-[17px] leading-[26px]">{data.region.tagline}</Text> : null}
            {data.region.story ? <Body muted>{data.region.story}</Body> : null}
          </View>

          {!data.region.is_live ? (
            <View className="bg-surface rounded-lg p-5">
              <Text className="font-body text-ink text-xl">
                {data.region.name} is coming soon. We are adding its clothing and spices.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
                {pills.map(([key, label, count]) => (
                  <Pressable
                    key={key}
                    accessibilityRole="link"
                    onPress={() => jump(key)}
                    className="border-line bg-paper min-h-11 flex-row items-center gap-1.5 rounded-pill border px-4"
                  >
                    <Text className="font-ui text-ink text-sm">{label}</Text>
                    {count !== null ? <Text className="font-ui text-ink-muted text-sm">{count}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
              <View onLayout={mark('new')}>
                <ProductRow
                  title="New arrivals"
                  sub={`Newest pieces from ${data.region.name}.`}
                  products={products.slice(0, ROW)}
                  seeAll={{ type: 'clothing', region: slug }}
                />
              </View>
              <ProductRow title="Most wanted" sub={`Most ordered from ${data.region.name} in the last 30 days.`} products={data.most_wanted} />
              <RegionAlbum photos={data.album} />
              <CuratedCard products={data.curated} regionName={data.region.name} />
              <ProductRow title="Leaving soon" sub="Only a few pieces left of these." products={data.leaving_soon} badge={(p) => `${p.available} left`} />
              {/* One row per clothing category, biggest first by its real total (the page carries its first 12). */}
              {categories.map((c) => (
                <View key={c.slug} onLayout={mark(`c-${c.slug}`)}>
                  <ProductRow title={c.name} products={c.items.slice(0, ROW)} seeAll={{ type: 'clothing', region: slug, category: c.slug }} />
                </View>
              ))}
              <View onLayout={mark('spices')}>
                {spices.length > 0 ? (
                  <ProductRow title="Spices" products={spices.slice(0, ROW)} seeAll={{ type: 'spice', region: slug }} />
                ) : (
                  <View className="gap-4 pt-2">
                    <Heading>Spices</Heading>
                    <View className="bg-surface rounded-lg p-5">
                      <Text className="font-body text-ink text-xl">Spices from {data.region.name} are coming soon.</Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

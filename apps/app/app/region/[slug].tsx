import { Link, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { getRegionPage } from '@repo/db/store';

import type { RegionProductCard } from '@repo/db/store';

import { Body, ErrorText, Heading, Label, Loading, Screen } from '@/components/ui';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { supabase, mediaUrl } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

function Section({
  title,
  sub,
  products,
  empty,
  badge,
}: {
  title: string;
  sub?: string;
  products: RegionProductCard[];
  empty?: string;
  badge?: (p: RegionProductCard) => string;
}): React.JSX.Element | null {
  if (products.length === 0 && !empty) return null;
  return (
    <View className="gap-4 pt-2">
      <View className="gap-1">
        <Heading>{title}</Heading>
        {sub ? <Body muted>{sub}</Body> : null}
      </View>
      {products.length === 0 ? (
        <View className="bg-surface rounded-lg p-5">
          <Text className="font-display text-ink text-xl">{empty}</Text>
        </View>
      ) : (
        <Grid>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} badge={badge?.(p)} />
          ))}
        </Grid>
      )}
    </View>
  );
}

/**
 * The core page (storefront.md §The region page, design.md §Direction). One store_region_page() call: the
 * greeting in its own script (the phone's system fonts cover every Indian script), New arrivals, Curated for you,
 * Leaving soon (D-056), then every piece under Clothing / Spices. Most wanted (D-058) comes next.
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
            <Text accessibilityRole="header" className="font-hero text-ink mt-3 text-[60px] leading-[62px] tracking-[-2.5px]">
              {data.region.name}
            </Text>
            {data.region.tagline ? <Body>{data.region.tagline}</Body> : null}
            {data.region.story ? <Body muted>{data.region.story}</Body> : null}
          </View>
          <View className="bg-brand aspect-[5/6] overflow-hidden rounded-lg" style={accent ? { backgroundColor: accent } : undefined}>
            {data.region.hero_image_path ? (
              <Image source={{ uri: mediaUrl(data.region.hero_image_path) }} accessibilityIgnoresInvertColors className="h-full w-full" resizeMode="cover" />
            ) : null}
          </View>

          {!data.region.is_live ? (
            <View className="bg-surface rounded-lg p-5">
              <Text className="font-display text-ink text-xl">
                {data.region.name} is coming soon. We are adding its clothing and spices.
              </Text>
            </View>
          ) : (
            <>
              <Section title="New arrivals" sub={`Newest pieces from ${data.region.name}.`} products={products.slice(0, 4)} />
              {data.curated.length > 0 ? (
                <View className="bg-surface gap-4 rounded-lg p-4">
                  <View className="gap-1">
                    <Label>Curated for you</Label>
                    <Heading>Picked for you</Heading>
                    <Body muted>Chosen by us from {data.region.name}.</Body>
                  </View>
                  <Grid>
                    {data.curated.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </Grid>
                </View>
              ) : null}
              <Section
                title="Leaving soon"
                sub="Only a few pieces left of these."
                products={data.leaving_soon}
                badge={(p) => `${p.available} left`}
              />
              <Section
                title="Clothing"
                products={products.filter((p) => p.product_type === 'clothing')}
                empty={`Clothing from ${data.region.name} is coming soon.`}
              />
              <Section
                title="Spices"
                products={products.filter((p) => p.product_type === 'spice')}
                empty={`Spices from ${data.region.name} are coming soon.`}
              />
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}

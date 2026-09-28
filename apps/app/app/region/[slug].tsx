import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { getRegionPage } from '@repo/db/store';

import type { RegionProductCard } from '@repo/db/store';

import { Body, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

function Section({
  title,
  products,
}: {
  title: string;
  products: RegionProductCard[];
}): React.JSX.Element {
  return (
    <View className="gap-2">
      <Heading>{title}</Heading>
      {products.length === 0 ? (
        <Body muted>Coming soon.</Body>
      ) : (
        <Grid>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} available={p.available} />
          ))}
        </Grid>
      )}
    </View>
  );
}

/** The core page (storefront.md §The region page). One store_region_page() call. */
export default function RegionScreen(): React.JSX.Element {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, error, loading, reload } = useQuery(`region:${slug}`, () =>
    getRegionPage(supabase, slug),
  );
  const accent = data?.region.accent_color ?? undefined;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This page doesn&apos;t exist.</Body> : null}
      {data ? (
        <>
          <View
            className="gap-1 border-l-4 pl-3"
            style={accent ? { borderLeftColor: accent } : undefined}
          >
            {data.region.greeting_native ? (
              <Text className="text-4xl" style={accent ? { color: accent } : undefined}>
                {data.region.greeting_native}
              </Text>
            ) : null}
            {data.region.greeting_latin || data.region.greeting_meaning ? (
              <Body muted>
                {[data.region.greeting_latin, data.region.greeting_meaning]
                  .filter(Boolean)
                  .join(' · ')}
              </Body>
            ) : null}
            <Title>{data.region.name}</Title>
            {data.region.tagline ? <Body>{data.region.tagline}</Body> : null}
            {data.region.story ? <Body muted>{data.region.story}</Body> : null}
          </View>
          {!data.region.is_live ? (
            <Body muted>
              {data.region.name} is coming soon. We are adding its clothing and spices.
            </Body>
          ) : null}
          <Section
            title="Clothing"
            products={data.products.filter((p) => p.product_type === 'clothing')}
          />
          <Section
            title="Spices"
            products={data.products.filter((p) => p.product_type === 'spice')}
          />
        </>
      ) : null}
    </Screen>
  );
}

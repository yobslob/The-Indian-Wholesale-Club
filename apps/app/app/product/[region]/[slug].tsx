import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { saveProduct } from '@repo/db/account';
import { getProductPage } from '@repo/db/store';
import tokens from '@repo/tokens';

import { Body, ErrorText, Heading, Label, Loading, Row, Screen } from '@/components/ui';
import { AddToBag } from '@/features/catalog/add-to-bag';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { Disclosure } from '@/features/catalog/disclosure';
import { Details, hasDetails, sizeRows } from '@/features/catalog/product-details';
import { ProductGallery } from '@/features/catalog/product-gallery';
import { ReviewsSection } from '@/features/reviews/reviews-section';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * storefront.md §The product page, design.md §Direction (D-051): photos, name with the heart, add to bag with the
 * delivery window, Details and Size chart behind + / −, the origin line, reviews, Similar items, Curated for you.
 * One store_product_page() call + live availability.
 */
export default function ProductScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const { region, slug } = useLocalSearchParams<{ region: string; slug: string }>();
  const { data, error, loading, reload } = useQuery(`product:${region}/${slug}`, () => getProductPage(supabase, region, slug));
  const [saved, setSaved] = useState(false);

  async function save(productId: string): Promise<void> {
    if (!session) {
      router.push('/auth/login');
      return;
    }
    await saveProduct(supabase, session.user.id, productId);
    setSaved(true);
  }

  const sizes = data ? sizeRows(data.product, data.variants) : [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This product is not available.</Body> : null}
      {data ? (
        <>
          <ProductGallery media={data.media} name={data.product.name} />
          <View className="bg-surface gap-4 rounded-lg p-5">
            <Link href={{ pathname: '/region/[slug]', params: { slug: data.product.region_slug } }} asChild>
              <Pressable className="min-h-8 justify-center">
                <Text className="font-ui text-ink-muted text-[13px]">
                  <Text className="underline">{data.product.region_name}</Text> · {data.product.category_name}
                </Text>
              </Pressable>
            </Link>
            <View className="flex-row items-start justify-between gap-3">
              <Text accessibilityRole="header" className="font-display text-ink flex-1 text-[34px] leading-[38px]">
                {data.product.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Saved to your account' : 'Save for later'}
                accessibilityState={{ selected: saved }}
                onPress={() => void save(data.product.id)}
                disabled={saved}
                className="border-line bg-paper h-12 w-12 items-center justify-center rounded-full border"
              >
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? tokens.colors.brand : tokens.colors.ink} />
              </Pressable>
            </View>
            {data.product.summary ? <Body muted>{data.product.summary}</Body> : null}
            {data.variants.length > 0 ? (
              <AddToBag product={data.product} variants={data.variants} delivery={<DeliveryNote delivery={data.delivery} />} />
            ) : (
              <Body muted>Not available right now.</Body>
            )}
            <View>
              {hasDetails(data.product) ? (
                <Disclosure title="Details" defaultOpen>
                  <Details product={data.product} />
                </Disclosure>
              ) : null}
              {sizes.length > 0 ? (
                <Disclosure title="Size chart">
                  {sizes.map(([size, length]) => (
                    <Row key={size} label={size} value={length} />
                  ))}
                </Disclosure>
              ) : null}
            </View>
            <Text className="border-line font-display-italic text-ink border-t pt-4 text-[18px]">
              Made in India · from {data.product.region_name} · Imported
            </Text>
          </View>

          <ReviewsSection reviews={data.reviews} productId={data.product.id} />

          {data.similar.length > 0 ? (
            <View className="gap-4 pt-2">
              <Heading>Similar items</Heading>
              <Grid>
                {data.similar.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </Grid>
            </View>
          ) : null}
          {data.curated.length > 0 ? (
            <View className="bg-surface gap-4 rounded-lg p-4">
              <View className="gap-1">
                <Label>Curated for you</Label>
                <Heading>Picked for you</Heading>
                <Body muted>Chosen by us from {data.product.region_name}.</Body>
              </View>
              <Grid>
                {data.curated.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </Grid>
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

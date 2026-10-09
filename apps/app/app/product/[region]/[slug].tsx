import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isProductSaved, saveProduct, unsaveProduct } from '@repo/db/account';
import { getProductPage } from '@repo/db/store';
import tokens from '@repo/tokens';

import { Body, ErrorText, Loading, Row, Screen } from '@/components/ui';
import { AddToBag } from '@/features/catalog/add-to-bag';
import { BuyBar, type BuyBarState } from '@/features/catalog/buy-bar';
import { CuratedCard } from '@/features/catalog/curated-card';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { Disclosure } from '@/features/catalog/disclosure';
import { Details, hasDetails, sizeRows } from '@/features/catalog/product-details';
import { ProductGallery } from '@/features/catalog/product-gallery';
import { ProductRow } from '@/features/catalog/product-row';
import { ReviewsSection } from '@/features/reviews/reviews-section';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * storefront.md §The product page (D-051, D-082, D-095): the photos edge to edge (any opens the viewer), name with the
 * heart, add to bag with the delivery window, Details and Size chart behind + / −, the origin line, reviews as a row,
 * Similar items, Curated for you; the buy bar slides up once Add to bag has scrolled away. One store_product_page()
 * call + live availability.
 */
export default function ProductScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const { region, slug } = useLocalSearchParams<{ region: string; slug: string }>();
  const { data, error, loading, reload } = useQuery(`product:${region}/${slug}`, () => getProductPage(supabase, region, slug));
  const [saved, setSaved] = useState(false);
  const productId = data?.product.id;
  const button = useRef<View>(null);
  const [bar, setBar] = useState<BuyBarState | null>(null);
  const [barShown, setBarShown] = useState(false);
  const onBar = useCallback((next: BuyBarState | null) => setBar(next), []);
  // The buy bar shows while the screen's own Add to bag is above the top of the screen (scrolled away).
  const onScroll = useCallback(() => {
    button.current?.measureInWindow((_x, y, _w, h) => setBarShown(y + h < 60));
  }, []);

  // B-18: show whether it is already saved (the customer's own rows only).
  useEffect(() => {
    if (!session || !productId) return setSaved(false);
    let live = true;
    void isProductSaved(supabase, productId)
      .then((isSaved) => live && setSaved(isSaved))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [session, productId]);

  async function toggleSave(id: string): Promise<void> {
    if (!session) {
      router.push('/auth/login');
      return;
    }
    if (saved) {
      await unsaveProduct(supabase, id);
      setSaved(false);
    } else {
      await saveProduct(supabase, session.user.id, id);
      setSaved(true);
    }
  }

  const sizes = data ? sizeRows(data.product, data.variants) : [];

  return (
    <Screen
      title={data?.product.name}
      refreshing={loading}
      onRefresh={reload}
      onScroll={onScroll}
      top={data ? <ProductGallery media={data.media} name={data.product.name} /> : null}
      overlay={<BuyBar state={bar} shown={barShown} />}
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This product is not available.</Body> : null}
      {data ? (
        <>
          <View className="bg-surface gap-4 rounded-lg p-5">
            <Link href={{ pathname: '/region/[slug]', params: { slug: data.product.region_slug } }} asChild>
              <Pressable className="min-h-8 justify-center">
                <Text className="font-ui text-ink-muted text-[13px]">
                  <Text className="underline">{data.product.region_name}</Text> · {data.product.category_name}
                </Text>
              </Pressable>
            </Link>
            <View className="flex-row items-start justify-between gap-3">
              <Text accessibilityRole="header" className="font-display flex-1 text-[32px] leading-[35px] text-[#1D1A17]">
                {data.product.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Saved. Remove from saved' : 'Save for later'}
                accessibilityState={{ selected: saved }}
                onPress={() => void toggleSave(data.product.id)}
                className="border-line bg-paper h-12 w-12 items-center justify-center rounded-full border"
              >
                <Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color={saved ? tokens.colors.brand : tokens.colors.ink} />
              </Pressable>
            </View>
            {data.product.summary ? <Body muted>{data.product.summary}</Body> : null}
            {data.variants.length > 0 ? (
              <AddToBag product={data.product} variants={data.variants} buttonRef={button} onBar={onBar} delivery={<DeliveryNote delivery={data.delivery} fromUs={data.ships_from_us} />} />
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
            <Text className="border-line font-display text-ink border-t pt-4 text-[18px]">
              Made in India · from {data.product.region_name} · Imported
            </Text>
          </View>

          <ReviewsSection reviews={data.reviews} productId={data.product.id} />

          <ProductRow
            title="Similar items"
            products={data.similar}
            seeAll={{ type: data.product.product_type, category: data.product.category_slug }}
          />
          <CuratedCard products={data.curated} regionName={data.product.region_name} />
        </>
      ) : null}
    </Screen>
  );
}

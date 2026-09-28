import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { saveProduct } from '@repo/db/account';
import { getProductPage } from '@repo/db/store';

import { Body, Button, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { AddToBag } from '@/features/catalog/add-to-bag';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { Details, Gallery } from '@/features/catalog/product-details';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** storefront.md §The product page. One store_product_page() call + live availability. */
export default function ProductScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const { region, slug } = useLocalSearchParams<{ region: string; slug: string }>();
  const { data, error, loading, reload } = useQuery(`product:${region}/${slug}`, () =>
    getProductPage(supabase, region, slug),
  );
  const [saved, setSaved] = useState(false);

  async function save(productId: string): Promise<void> {
    if (!session) {
      router.push('/auth/login');
      return;
    }
    await saveProduct(supabase, session.user.id, productId);
    setSaved(true);
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data === null ? <Body muted>This product is not available.</Body> : null}
      {data ? (
        <>
          <Gallery media={data.media} name={data.product.name} />
          <Text className="text-ink-muted text-sm">{data.product.region_name}</Text>
          <Title>{data.product.name}</Title>
          {data.product.summary ? <Body muted>{data.product.summary}</Body> : null}
          {data.variants.length > 0 ? (
            <AddToBag product={data.product} variants={data.variants} />
          ) : (
            <Body muted>Not available right now.</Body>
          )}
          <Button
            kind="link"
            label={saved ? 'Saved to your account' : 'Save for later'}
            disabled={saved}
            onPress={() => void save(data.product.id)}
          />
          <DeliveryNote delivery={data.delivery} />
          <Details product={data.product} />
        </>
      ) : null}
    </Screen>
  );
}

import { Link, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { getHome } from '@repo/db/store';
import { formatUsd } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { Body, Button, Label, Screen } from '@/components/ui';
import { bagSubtotalCents, MAX_QTY_PER_LINE, useBag } from '@/features/cart/store';
import { ProductRow } from '@/features/catalog/product-row';
import { StampGrid } from '@/features/regions/stamps';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** The empty bag is never a dead end (D-086): the open states and Just listed under its sentence. */
function EmptyBag(): React.JSX.Element {
  const { data } = useQuery('home', () => getHome(supabase));
  return (
    <>
      <Body>Your bag is empty. Find something from home.</Body>
      {data ? (
        <>
          <View className="gap-3">
            <Label>Open now</Label>
            <StampGrid regions={data.regions.filter((r) => r.is_live)} delivery={data.delivery} />
          </View>
          <ProductRow title="Just listed" products={data.just_listed} seeAll={{ type: 'clothing' }} />
        </>
      ) : null}
    </>
  );
}

/**
 * The Bag tab (D-086, D-095): a photo on each line (it and the name open the piece), − / number / + within 1 – 10,
 * Remove, the subtotal and Checkout. In the app the bag is its own tab, so there is no bag panel. Prices are
 * indicative; checkout re-prices on the server (D-038).
 */
export default function BagScreen(): React.JSX.Element {
  const router = useRouter();
  const { lines, setQuantity } = useBag();
  const step = 'h-10 w-10 items-center justify-center';

  return (
    <Screen back={false} title="Your bag">
      {lines.length === 0 ? (
        <EmptyBag />
      ) : (
        <>
          <View className="border-line border-t">
            {lines.map((line) => {
              const href = { pathname: '/product/[region]/[slug]' as const, params: { region: line.regionSlug, slug: line.productSlug } };
              return (
                <View key={line.variantId} className="border-line flex-row gap-3.5 border-b py-3.5">
                  <Link href={href} asChild>
                    <Pressable accessibilityLabel={line.productName} className="bg-land aspect-[3/4] w-16 overflow-hidden rounded-xl">
                      {line.imagePath ? <Photo path={line.imagePath} width={64} /> : null}
                    </Pressable>
                  </Link>
                  <View className="flex-1 justify-between gap-2">
                    <View className="flex-row justify-between gap-3">
                      <Link href={href} asChild>
                        <Pressable className="flex-1">
                          <Text className="font-ui-semibold text-ink text-[15px]">{line.productName}</Text>
                          <Text className="font-ui text-ink-muted text-[13px]">
                            {line.variantLabel} · {line.regionName}
                          </Text>
                        </Pressable>
                      </Link>
                      <Text className="font-ui-semibold text-ink text-[15px]">{formatUsd(line.unitPriceCents * line.quantity)}</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <View className="border-line bg-paper h-10 flex-row items-center rounded-pill border" accessibilityLabel={`Quantity of ${line.productName}`}>
                        <Pressable accessibilityRole="button" accessibilityLabel="One fewer" disabled={line.quantity <= 1} onPress={() => setQuantity(line.variantId, line.quantity - 1)} className={step}>
                          <Text className={`font-ui text-lg ${line.quantity <= 1 ? 'text-line' : 'text-ink'}`}>−</Text>
                        </Pressable>
                        <Text className="font-ui-semibold text-ink min-w-[18px] text-center text-[15px]">{line.quantity}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="One more"
                          disabled={line.quantity >= MAX_QTY_PER_LINE}
                          onPress={() => setQuantity(line.variantId, line.quantity + 1)}
                          className={step}
                        >
                          <Text className={`font-ui text-lg ${line.quantity >= MAX_QTY_PER_LINE ? 'text-line' : 'text-ink'}`}>+</Text>
                        </Pressable>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.productName}`} onPress={() => setQuantity(line.variantId, 0)} className="min-h-10 justify-center">
                        <Text className="font-ui text-ink text-[13px] underline">Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <View className="gap-1">
            <Text className="font-ui text-ink text-base">
              Subtotal <Text className="font-ui-semibold">{formatUsd(bagSubtotalCents(lines))}</Text>
            </Text>
            <Body muted>Shipping, tax and delivery dates are shown at checkout.</Body>
          </View>
          <Button label="Checkout" onPress={() => router.push('/checkout')} />
        </>
      )}
    </Screen>
  );
}

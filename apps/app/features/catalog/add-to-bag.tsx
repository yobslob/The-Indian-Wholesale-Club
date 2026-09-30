import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatUsd } from '@repo/shared/domain';

import { useLiveAvailability } from './use-live-availability';

import type { Product, Variant } from '@repo/db/store';

import { Button } from '@/components/ui';
import { MAX_QTY_PER_LINE, useBag } from '@/features/cart/store';

/** Variant picker + live availability + add to bag. */
export function AddToBag({
  product,
  variants,
  delivery,
}: {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'
  >;
  variants: Variant[];
  /** Shown just above the button (the delivery window, D-008). */
  delivery?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, v.available])),
    [variants],
  );
  const available = useLiveAvailability(product.id, initial);
  const add = useBag((s) => s.add);
  const [variantId, setVariantId] = useState(
    () => variants.find((v) => v.available > 0)?.id ?? variants[0]?.id,
  );
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId);
  if (!variant) return <Text className="text-ink-muted text-sm">Not available right now.</Text>;
  const left = available[variant.id] ?? 0;
  const soldOut = left <= 0;
  const maxQty = Math.max(1, Math.min(left, MAX_QTY_PER_LINE));

  return (
    <View className="gap-3">
      <Text className="font-ui-semibold text-ink text-[22px]">{formatUsd(variant.price_cents)}</Text>
      {variants.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {variants.map((v) => {
            const selected = v.id === variantId;
            return (
              <Pressable
                key={v.id}
                onPress={() => {
                  setVariantId(v.id);
                  setQuantity(1);
                  setAdded(false);
                }}
                accessibilityState={{ selected }}
                className={`bg-paper min-h-11 justify-center rounded-pill border px-4 ${selected ? 'border-ink border-2' : 'border-line'}`}
              >
                <Text className="font-ui text-ink text-sm">
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View className="flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${soldOut ? 'bg-caution' : 'bg-region'}`} />
        <Text className={`font-body text-sm ${soldOut ? 'text-caution' : 'text-ink'}`}>
          {soldOut ? 'Sold out' : left <= 3 ? `Only ${left} left` : 'In stock'}
        </Text>
      </View>
      {delivery ? <View className="bg-paper rounded-md px-4 py-3">{delivery}</View> : null}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          className="border-line bg-paper min-h-11 min-w-11 items-center justify-center rounded-full border"
          accessibilityLabel="One less"
        >
          <Text className="font-ui text-ink text-lg">−</Text>
        </Pressable>
        <Text className="font-ui text-ink w-6 text-center">{quantity}</Text>
        <Pressable
          onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
          className="border-line bg-paper min-h-11 min-w-11 items-center justify-center rounded-full border"
          accessibilityLabel="One more"
        >
          <Text className="font-ui text-ink text-lg">+</Text>
        </Pressable>
        <View className="flex-1">
          <Button
            label="Add to bag"
            disabled={soldOut}
            onPress={() => {
              add(
                {
                  variantId: variant.id,
                  productId: product.id,
                  productName: product.name,
                  productSlug: product.slug,
                  regionSlug: product.region_slug,
                  regionName: product.region_name,
                  variantLabel: variant.label,
                  unitPriceCents: variant.price_cents,
                  imagePath: product.primary_image_path,
                },
                quantity,
              );
              setAdded(true);
            }}
          />
        </View>
      </View>
      {added ? (
        <Button kind="link" label="Added. View bag" onPress={() => router.push('/bag')} />
      ) : null}
    </View>
  );
}

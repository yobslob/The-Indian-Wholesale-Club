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
}: {
  product: Pick<
    Product,
    'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'
  >;
  variants: Variant[];
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
      <Text className="text-ink text-xl">{formatUsd(variant.price_cents)}</Text>
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
                className={`min-h-11 justify-center rounded-sm border px-3 ${selected ? 'border-ink bg-ink' : 'border-line'}`}
              >
                <Text className={selected ? 'text-canvas text-sm' : 'text-ink text-sm'}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Text className={soldOut ? 'text-caution text-sm' : 'text-ink-muted text-sm'}>
        {soldOut ? 'Sold out' : left <= 3 ? `Only ${left} left` : 'In stock'}
      </Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => setQuantity((q) => Math.max(1, q - 1))}
          className="border-line min-h-11 min-w-11 items-center justify-center rounded-sm border"
          accessibilityLabel="One less"
        >
          <Text className="text-ink">−</Text>
        </Pressable>
        <Text className="text-ink w-6 text-center">{quantity}</Text>
        <Pressable
          onPress={() => setQuantity((q) => Math.min(maxQty, q + 1))}
          className="border-line min-h-11 min-w-11 items-center justify-center rounded-sm border"
          accessibilityLabel="One more"
        >
          <Text className="text-ink">+</Text>
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

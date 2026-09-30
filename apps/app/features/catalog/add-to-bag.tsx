import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { choose, formatUsd, isAvailable, optionAxes, selectionOf } from '@repo/shared/domain';

import { useLiveAvailability } from './use-live-availability';

import type { Product, Variant } from '@repo/db/store';

import { Button } from '@/components/ui';
import { MAX_QTY_PER_LINE, useBag } from '@/features/cart/store';

function Choice({
  label,
  selected,
  out,
  onPress,
}: {
  label: string;
  selected: boolean;
  out: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={out ? 'Sold out' : undefined}
      className={`bg-paper min-h-11 justify-center rounded-pill border px-4 ${selected ? 'border-ink border-2' : 'border-line'} ${out ? 'opacity-50' : ''}`}
    >
      <Text className={`font-ui text-ink text-sm ${out ? 'line-through' : ''}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Variant picker + live availability + add to bag. Colour and size get a row each when the variants carry them
 * (`optionAxes`, shared with the website); otherwise one button per variant.
 */
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

  const axes = useMemo(() => optionAxes(variants), [variants]);
  const variant = variants.find((v) => v.id === variantId);
  if (!variant) return <Text className="text-ink-muted text-sm">Not available right now.</Text>;
  const inStock = (v: Variant): boolean => (available[v.id] ?? 0) > 0;
  const selection = selectionOf(variant, axes);
  const select = (id: string): void => {
    setVariantId(id);
    setQuantity(1);
    setAdded(false);
  };
  const left = available[variant.id] ?? 0;
  const soldOut = left <= 0;
  const maxQty = Math.max(1, Math.min(left, MAX_QTY_PER_LINE));

  return (
    <View className="gap-3">
      <Text className="font-ui-semibold text-ink text-[22px]">{formatUsd(variant.price_cents)}</Text>
      {axes.map((axis) => (
        <View key={axis.key} className="gap-2">
          <Text className="font-ui-semibold text-ink-muted text-[11px] uppercase tracking-[1.8px]">
            {axis.label}: <Text className="font-ui text-ink normal-case tracking-normal">{selection[axis.key]}</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {axis.values.map((value) => (
              <Choice
                key={value}
                label={value}
                selected={selection[axis.key] === value}
                out={!isAvailable(variants, axes, selection, axis.key, value, inStock)}
                onPress={() => {
                  const next = choose(variants, axes, selection, axis.key, value, inStock);
                  if (next) select(next.id);
                }}
              />
            ))}
          </View>
        </View>
      ))}
      {axes.length === 0 && variants.length > 1 ? (
        <View className="flex-row flex-wrap gap-2">
          {variants.map((v) => (
            <Choice key={v.id} label={v.label} selected={v.id === variantId} out={!inStock(v)} onPress={() => select(v.id)} />
          ))}
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

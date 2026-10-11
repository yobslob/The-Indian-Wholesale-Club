import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { getBagCharges, type BagCharges } from '@repo/db/store';
import { formatUsd } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

import { bagCount, bagSubtotalCents, useBag, type BagLine } from './store';

const bagKey = (lines: BagLine[]): string =>
  lines
    .map((l) => `${l.variantId}:${l.quantity}`)
    .sort()
    .join(',');

/** D-111: the bag's small-order charges, worked out by the database (one query per bag, kept while the next loads). */
export function useBagCharges(): BagCharges | null {
  const lines = useBag((s) => s.lines);
  const key = bagKey(lines);
  const { data } = useQuery(`bag-charges:${key}`, () =>
    key
      ? getBagCharges(
          supabase,
          lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        )
      : Promise.resolve(null),
  );
  return key ? (data ?? null) : null;
}

function freeDelivery(lines: BagLine[], charges: BagCharges | null) {
  const subtotal = bagSubtotalCents(lines);
  const line = charges?.free_min_cents ?? null;
  const free = line !== null && subtotal >= line;
  return {
    free,
    line,
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
  };
}

/** "$19.79", or struck through and "Free" from the free-delivery line up. */
export function ChargeValue({ cents, free }: { cents: number; free: boolean }): React.JSX.Element {
  if (cents === 0) return <Text className="font-body text-ink text-sm">Free</Text>;
  return free ? (
    <Text className="font-body text-ink text-sm">
      <Text className="text-ink-muted line-through">{formatUsd(cents)}</Text> Free
    </Text>
  ) : (
    <Text className="font-body text-ink text-sm">{formatUsd(cents)}</Text>
  );
}

function ChargeRow({
  label,
  cents,
  free,
}: {
  label: string;
  cents: number;
  free: boolean;
}): React.JSX.Element {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="font-body text-ink-muted flex-1 text-sm">{label}</Text>
      <ChargeValue cents={cents} free={free} />
    </View>
  );
}

/** The bag's Shipping and Retailer charges under its subtotal (D-111), with how much more makes them free. */
export function ChargeRows(): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, leftCents, line } = freeDelivery(lines, charges);
  return (
    <View className="gap-1">
      <ChargeRow label="Shipping" cents={charges.shipping_cents} free={free} />
      {charges.retailer_cents > 0 ? (
        <ChargeRow label="Retailer charges" cents={charges.retailer_cents} free={free} />
      ) : null}
      {line !== null && !free ? (
        <Text className="font-ui-semibold text-brand text-[13px]">
          Add {formatUsd(leftCents)} more for free delivery
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The free-delivery bar (D-111) above the tab bar once a piece is in the bag: how much more unlocks free delivery, a
 * progress line, the count and the newest photo; a tap opens the Bag tab.
 */
export function FreeDeliveryBar({ onPress }: { onPress: () => void }): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  if (lines.length === 0 || !charges || charges.free_min_cents === null) return null;
  const { free, leftCents, share } = freeDelivery(lines, charges);
  const count = bagCount(lines);
  const newest = lines[lines.length - 1];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        free
          ? `Free delivery unlocked. Bag, ${count} items`
          : `Add ${formatUsd(leftCents)} more to unlock free delivery. Bag, ${count} items`
      }
      onPress={onPress}
      className="bg-brand mx-3 mb-2 rounded-[18px] px-4 pb-3 pt-3"
    >
      <View className="flex-row items-center gap-3">
        <Text className="font-ui-semibold text-on-brand flex-1 text-[15px] leading-tight">
          {free
            ? 'FREE DELIVERY unlocked'
            : `Add ${formatUsd(leftCents)} more to unlock FREE DELIVERY`}
        </Text>
        <View className="items-end">
          <Text className="font-ui-semibold text-on-brand text-[15px]">BAG</Text>
          <Text className="font-ui text-on-brand text-[12px]">
            {count} {count === 1 ? 'ITEM' : 'ITEMS'}
          </Text>
        </View>
        {newest?.imagePath ? (
          <View className="bg-paper h-11 w-9 overflow-hidden rounded-[6px]">
            <Photo path={newest.imagePath} width={36} />
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
      </View>
      <View className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-white/25">
        <View
          className="h-full rounded-full bg-white"
          style={{ width: `${Math.max(share * 100, 4)}%` }}
        />
      </View>
    </Pressable>
  );
}

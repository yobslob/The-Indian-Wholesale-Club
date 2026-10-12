import { Text, View } from 'react-native';

import { getBagCharges, type BagCharges } from '@repo/db/store';
import { formatUsd } from '@repo/shared/domain';

import { MeterLine } from './meter-line';
import { bagSubtotalCents, useBag, type BagLine } from './store';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

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

/** Where the bag stands against the free-delivery line (D-111). */
export function freeDelivery(lines: BagLine[], charges: BagCharges | null) {
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

/** "$18.79", or struck through and "$0.00" from the free-delivery line up (D-112). */
export function ChargeValue({ cents, free }: { cents: number; free: boolean }): React.JSX.Element {
  if (cents === 0) return <Text className="font-body text-ink text-sm">{formatUsd(0)}</Text>;
  return free ? (
    <Text className="font-body text-ink text-sm">
      <Text className="text-ink-muted line-through">{formatUsd(cents)}</Text> {formatUsd(0)}
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
  const { free, leftCents, line, share } = freeDelivery(lines, charges);
  return (
    <View className="gap-1">
      <ChargeRow label="Shipping" cents={charges.shipping_cents} free={free} />
      {charges.retailer_cents > 0 ? (
        <ChargeRow label="Retailer charges" cents={charges.retailer_cents} free={free} />
      ) : null}
      {line !== null && !free ? (
        <View className="mt-1 gap-2">
          <Text className="font-ui-semibold text-brand text-[13px]">
            Add {formatUsd(leftCents)} more for free delivery
          </Text>
          <MeterLine share={share} />
        </View>
      ) : null}
    </View>
  );
}

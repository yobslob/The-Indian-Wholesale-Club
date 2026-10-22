import { Text, View } from 'react-native';

import { getBagCharges, getQuickBag, smallOrderOf, type BagCharges, type QuickBag } from '@repo/db/store';
import { bagChargesAt, bulkProgress, formatUsd } from '@repo/shared/domain';

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

/**
 * D-148: the 7-day days while every piece in the bag is a 7-day piece, else null (the same store_quick_bag read as the
 * website's /api/bag-charges `quick`). One query per set of pieces; quantities don't change it.
 */
export function useQuickBag(): QuickBag {
  const lines = useBag((s) => s.lines);
  const ids = lines.map((l) => l.variantId).sort();
  const key = ids.join(',');
  const { data } = useQuery(`quick-bag:${key}`, () => (key ? getQuickBag(supabase, ids) : Promise.resolve(null)));
  return key ? (data ?? null) : null;
}

/** Where the bag stands against the free-delivery line (D-111) and, from it up, on the bulk saving (D-119). */
export function freeDelivery(lines: BagLine[], charges: BagCharges | null) {
  const subtotal = bagSubtotalCents(lines);
  const line = charges?.free_min_cents ?? null;
  const free = line !== null && subtotal >= line;
  const bulk =
    charges && charges.bulk_saving_pct > 0 && charges.bulk_saving_cap_cents > 0
      ? { pct: charges.bulk_saving_pct, capCents: charges.bulk_saving_cap_cents }
      : null;
  return {
    free,
    line,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at: bagChargesAt(subtotal, line, charges ? smallOrderOf(charges) : null),
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
    bulk: bulkProgress(subtotal, line, bulk),
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
  const { free, leftCents, line, share, bulk, at } = freeDelivery(lines, charges);
  return (
    <View className="gap-1">
      <ChargeRow label="Shipping" cents={at.shippingCents || at.waivedShippingCents} free={free && at.shippingCents === 0} />
      {at.retailerCents + at.waivedRetailerCents > 0 ? (
        <ChargeRow label="Retailer charges" cents={at.retailerCents || at.waivedRetailerCents} free={free} />
      ) : null}
      {bulk.savingCents > 0 ? (
        <View className="flex-row justify-between gap-3">
          <Text className="font-body text-ink-muted flex-1 text-sm">Bulk saving</Text>
          <Text className="font-body text-positive text-sm">−{formatUsd(bulk.savingCents)}</Text>
        </View>
      ) : null}
      {line !== null && !free ? (
        <View className="mt-1 gap-2">
          <Text className="font-ui-semibold text-brand text-[13px]">
            Add {formatUsd(leftCents)} more for free delivery
          </Text>
          <MeterLine share={share} />
        </View>
      ) : null}
      {/* D-119: from the line up, how the bulk saving grows and where it stops. */}
      {free && bulk.capCents > 0 ? (
        <View className="mt-1 gap-2">
          <Text className="font-ui-semibold text-brand text-[13px]">
            {bulk.capped
              ? `You've unlocked the biggest bulk saving: ${formatUsd(bulk.capCents)}`
              : `Every ${formatUsd(bulk.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(bulk.capCents)}`}
          </Text>
          <MeterLine share={bulk.share} />
        </View>
      ) : null}
    </View>
  );
}

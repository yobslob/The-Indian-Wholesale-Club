import { Text, View } from 'react-native';

import { getBagCharges, heavyOf, smallOrderOf, type BagCharges } from '@repo/db/store';
import { bagChargesAt, bagGoal, bulkProgress, formatUsd, heavyShippingAt } from '@repo/shared/domain';

import { MeterLine } from './meter-line';
import { bagSubtotalCents, useBag, type BagLine } from './store';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

export const bagKey = (lines: BagLine[]): string =>
  lines
    .map((l) => `${l.variantId}:${l.quantity}`)
    .sort()
    .join(',');

/** A bag's charges with the bag they answer (bagKey): an earlier bag's answer never decides the goal (bag-goal.ts). */
export type KeyedCharges = BagCharges & { bagKey: string };

/** D-111: the bag's small-order charges, worked out by the database (one query per bag, kept while the next loads). */
export function useBagCharges(): KeyedCharges | null {
  const lines = useBag((s) => s.lines);
  const key = bagKey(lines);
  const { data } = useQuery(`bag-charges:${key}`, () =>
    key
      ? getBagCharges(
          supabase,
          lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ).then((charges): KeyedCharges => ({ ...charges, bagKey: key }))
      : Promise.resolve(null),
  );
  return key ? (data ?? null) : null;
}

/**
 * Where the bag stands against the free-delivery line (D-111) and on the bulk saving (D-119, its own line, D-187). Founder
 * 2026-10-30: the goal is the bag as it is now, also while the next answer loads.
 */
export function freeDelivery(lines: BagLine[], charges: KeyedCharges | null) {
  const subtotal = bagSubtotalCents(lines);
  const line = charges?.free_min_cents ?? null;
  const free = line !== null && subtotal >= line;
  const bulk =
    charges && charges.bulk_saving_pct > 0 && charges.bulk_saving_cap_cents > 0
      ? { pct: charges.bulk_saving_pct, capCents: charges.bulk_saving_cap_cents }
      : null;
  const small = charges ? smallOrderOf(charges) : null;
  const bulkFrom = charges?.bulk_saving_from_cents ?? null;
  const progress = bulkProgress(subtotal, bulkFrom, bulk);
  const goal = bagGoal({ subtotalCents: subtotal, freeMinCents: line, bulk: progress });
  const at = bagChargesAt(subtotal, line, small);
  return {
    free,
    line,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at,
    /** Heavy-item shipping (founder 2026-10-24): paid, and its whole struck through once the saving's line took its % off. */
    heavy: heavyShippingAt(charges ? heavyOf(charges) : null, bulkFrom !== null && subtotal >= bulkFrom),
    leftCents: line === null ? 0 : Math.max(line - subtotal, 0),
    share: line ? Math.min(subtotal / line, 1) : 1,
    bulk: progress,
    /** The one goal the pill and the Bag show (bag-goal.ts, founder 2026-10-24): never two bars. */
    goal,
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

/** Heavy-item shipping: "$65.22", or struck through and "$52.18" once a line took its % off. */
export function ReducedValue({ cents, shownCents }: { cents: number; shownCents: number }): React.JSX.Element {
  return shownCents > cents ? (
    <Text className="font-body text-ink text-sm">
      <Text className="text-ink-muted line-through">{formatUsd(shownCents)}</Text> {formatUsd(cents)}
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

/** The bag's Shipping and Retailer charges under its subtotal (D-111), with its one goal and bar (bag-goal.ts). */
export function ChargeRows(): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, bulk, at, heavy, goal } = freeDelivery(lines, charges);
  const words =
    goal.kind === 'free-gap'
      ? `Add ${formatUsd(goal.leftCents)} more for free delivery`
      : goal.kind !== 'free'
        ? null
        : bulk.capped
          ? `You've unlocked the biggest bulk saving: ${formatUsd(bulk.capCents)}`
          : bulk.savingCents > 0
            ? `Every ${formatUsd(bulk.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(bulk.capCents)}`
            : 'Free delivery unlocked';
  return (
    <View className="gap-1">
      <ChargeRow
        label="Shipping"
        cents={at.shippingCents || at.waivedShippingCents}
        free={at.shippingFree}
      />
      {at.retailerCents + at.waivedRetailerCents > 0 ? (
        <ChargeRow
          label="Retailer charges"
          cents={at.retailerCents || at.waivedRetailerCents}
          free={free}
        />
      ) : null}
      {heavy.cents > 0 ? (
        <View className="flex-row justify-between gap-3">
          <Text className="font-body text-ink-muted flex-1 text-sm">Heavy-item shipping</Text>
          <ReducedValue cents={heavy.cents} shownCents={heavy.shownCents} />
        </View>
      ) : null}
      {bulk.savingCents > 0 ? (
        <View className="flex-row justify-between gap-3">
          <Text className="font-body text-ink-muted flex-1 text-sm">Bulk saving</Text>
          <Text className="font-body text-positive text-sm">−{formatUsd(bulk.savingCents)}</Text>
        </View>
      ) : null}
      {words && goal.kind !== 'none' ? (
        <View className="mt-1 gap-2">
          <Text className="font-ui-semibold text-brand text-[13px]">{words}</Text>
          {/* past the line the bar stays full (founder 2026-10-30); the words say the bulk saving */}
          <MeterLine share={goal.share} />
        </View>
      ) : null}
    </View>
  );
}

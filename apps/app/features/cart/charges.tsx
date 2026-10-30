import { Text, View } from 'react-native';

import { getBagCharges, heavyOf, smallOrderOf, type BagCharges } from '@repo/db/store';
import { bagChargesAt, bagGoal, bulkProgress, formatUsd, heavyShippingAt, parseBagShipments } from '@repo/shared/domain';

import { MeterLine } from './meter-line';
import { bagSubtotalCents, useBag, type BagLine } from './store';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const bagKey = (lines: BagLine[]): string =>
  lines
    .map((l) => `${l.variantId}:${l.quantity}`)
    .sort()
    .join(',');

/** A bag's charges with the bag they answer (bagKey): an earlier bag's answer never decides the goal (bag-goal.ts). */
export type KeyedCharges = BagCharges & { bagKey: string };

// Which options are 7-day, from every answer so far (an answer names its bag's 7-day options; the others are not)
const quickKnown = new Map<string, boolean>();

/** D-111: the bag's small-order charges, worked out by the database (one query per bag, kept while the next loads). */
export function useBagCharges(): KeyedCharges | null {
  const lines = useBag((s) => s.lines);
  const key = bagKey(lines);
  const { data } = useQuery(`bag-charges:${key}`, () =>
    key
      ? getBagCharges(
          supabase,
          lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        ).then((charges): KeyedCharges => {
          const quick = new Set(parseBagShipments(charges)?.quickIds ?? []);
          for (const l of lines) quickKnown.set(l.variantId, quick.has(l.variantId));
          return { ...charges, bagKey: key };
        })
      : Promise.resolve(null),
  );
  return key ? (data ?? null) : null;
}

/**
 * Where the bag stands against the free-delivery line (D-111) and, from it up, on the bulk saving (D-119). Founder
 * 2026-10-30: the goal is the bag as it is now: while the next answer loads, which pieces are 7-day comes from each
 * line's add and earlier answers, never from the last bag's answer.
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
  const facts = charges ? parseBagShipments(charges) : null;
  const fresh = charges !== null && charges.bagKey === bagKey(lines);
  const progress = bulkProgress(subtotal, line, bulk);
  const goal = bagGoal({
    subtotalCents: subtotal,
    freeMinCents: line,
    at: bagChargesAt(subtotal, line, small),
    bulk: progress,
    facts: fresh ? facts : null,
    variantIds: lines.map((l) => l.variantId),
    known: {
      quickIds: lines.filter((l) => quickKnown.get(l.variantId) ?? l.quick === true).map((l) => l.variantId),
      quickMinCents: facts?.minCents ?? null,
      quickTo: facts?.dates.quickTo ?? null,
    },
  });
  // an earlier bag's answer: free 7-day Shipping follows this bag's goal, not that answer
  const at = bagChargesAt(subtotal, line, small && !fresh ? { ...small, quickFree: goal.kind === 'quick-free' } : small);
  return {
    free,
    line,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at,
    /** Heavy-item shipping (founder 2026-10-24): paid, and its whole struck through once a line took its % off. */
    heavy: heavyShippingAt(charges ? heavyOf(charges) : null, free || at.shippingFree),
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
    goal.kind === 'quick-gap'
      ? `Add ${formatUsd(goal.leftCents)} more for free 7-day delivery`
      : goal.kind === 'quick-free'
        ? `Free 7-day delivery${goal.arrivesBy ? `: arrives by ${goal.arrivesBy}` : ' unlocked'}`
        : goal.kind === 'free-gap'
          ? `Add ${formatUsd(goal.leftCents)} more for free delivery`
          : goal.kind === 'free' && bulk.capCents > 0
            ? bulk.capped
              ? `You've unlocked the biggest bulk saving: ${formatUsd(bulk.capCents)}`
              : `Every ${formatUsd(bulk.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(bulk.capCents)}`
            : null;
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

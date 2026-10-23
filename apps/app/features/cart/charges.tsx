import { Text, View } from 'react-native';

import { getBagCharges, heavyOf, smallOrderOf, type BagCharges } from '@repo/db/store';
import { bagChargesAt, bulkProgress, formatUsd, heavyShippingAt, parseBagShipments, quickMeter } from '@repo/shared/domain';

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

/** Where the bag stands against the free-delivery line (D-111) and, from it up, on the bulk saving (D-119). */
export function freeDelivery(lines: BagLine[], charges: BagCharges | null) {
  const subtotal = bagSubtotalCents(lines);
  const line = charges?.free_min_cents ?? null;
  const free = line !== null && subtotal >= line;
  const bulk =
    charges && charges.bulk_saving_pct > 0 && charges.bulk_saving_cap_cents > 0
      ? { pct: charges.bulk_saving_pct, capCents: charges.bulk_saving_cap_cents }
      : null;
  const at = bagChargesAt(subtotal, line, charges ? smallOrderOf(charges) : null);
  return {
    free,
    line,
    /** D-125: the charges at this bag's goods (Shipping and the retailer charges, paid or struck through). */
    at,
    /** Heavy-item shipping (founder 2026-10-24): paid, and its whole struck through once a line took its % off. */
    heavy: heavyShippingAt(charges ? heavyOf(charges) : null, free || at.shippingFree),
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

/** The bag's Shipping and Retailer charges under its subtotal (D-111), with how much more makes them free. */
export function ChargeRows(): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, leftCents, line, share, bulk, at, heavy } = freeDelivery(lines, charges);
  // D-154: the 7-day meter (the 7-day pieces against the 7-day line) above the free-delivery one
  const facts = parseBagShipments(charges);
  const quick = quickMeter(facts);
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
      {quick ? (
        <View className="mt-1 gap-2">
          <Text className="font-ui-semibold text-brand text-[13px]">
            7-day delivery: {formatUsd(quick.cents)} of {formatUsd(quick.minCents)}
          </Text>
          <MeterLine share={quick.share} />
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

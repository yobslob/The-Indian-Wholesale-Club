'use client';

import { formatUsd, type BagGoal } from '@repo/shared/domain';

import { useDays } from '@/features/shell/days';

import { bagSaving, freeDelivery, useBagCharges } from './charges';
import { FreeMeter, useSurge } from './free-meter';
import { useCart } from './store';


/** "$18.79", or "$18.79" struck through and "$0.00" once the bag reaches the free-delivery line (D-111, D-112). */
export function ChargeValue({ cents, free }: { cents: number; free: boolean }): React.JSX.Element {
  if (cents === 0) return <span>{formatUsd(0)}</span>;
  return free ? (
    <span>
      <s className="text-ink-muted mr-1.5" aria-label={`was ${formatUsd(cents)}`}>
        {formatUsd(cents)}
      </s>
      {formatUsd(0)}
    </span>
  ) : (
    <span>{formatUsd(cents)}</span>
  );
}

/** Heavy-item shipping: "$65.22", or "$65.22" struck through and "$52.18" once a line took its % off (founder 2026-10-24). */
export function ReducedValue({ cents, shownCents }: { cents: number; shownCents: number }): React.JSX.Element {
  return shownCents > cents ? (
    <span>
      <s className="text-ink-muted mr-1.5" aria-label={`was ${formatUsd(shownCents)}`}>
        {formatUsd(shownCents)}
      </s>
      {formatUsd(cents)}
    </span>
  ) : (
    <span>{formatUsd(cents)}</span>
  );
}

/**
 * The bag's Shipping and Retailer charges under its subtotal (D-111, D-125): Shipping is at least the parcel's amount,
 * more when the bag's pieces cannot pay for the parcel, paid below the free-delivery line and struck through above it; the
 * Retailer charges are always paid (D-191). Heavy-item shipping, when the bag has a heavy piece (founder 2026-10-24), is always paid, less its % from
 * $99.99 (D-187). Checkout prices them again on the server.
 */
export function ChargeLines(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  const days = useDays();
  if (!charges) return null;
  const { bulk, bulkFrom, at, heavy, goal } = freeDelivery(lines, charges, days);
  const row = 'flex items-baseline justify-between gap-3 text-[14px]';
  return (
    <div className="font-ui grid gap-1" aria-live="polite">
      <p className={row}>
        <span>Shipping</span>
        <ChargeValue cents={at.shippingCents || at.waivedShippingCents} free={at.shippingFree} />
      </p>
      {at.retailerCents > 0 ? (
        <p className={row}>
          <span>Retailer charges</span>
          <span>{formatUsd(at.retailerCents)}</span>
        </p>
      ) : null}
      {heavy.cents > 0 ? (
        <p className={row}>
          <span>Heavy-item shipping</span>
          <ReducedValue cents={heavy.cents} shownCents={heavy.shownCents} />
        </p>
      ) : null}
      {bulk.savingCents > 0 ? (
        <p className={row}>
          <span>Bulk saving</span>
          <span className="text-positive font-semibold">−{formatUsd(bulk.savingCents)}</span>
        </p>
      ) : null}
      <GoalMeter goal={goal} bulkFrom={bulkFrom} />
      <SavingLine cents={bagSaving(lines, charges, days)} />
    </div>
  );
}

/** D-140 (F5): "You're saving $X" in the brand colour above the total, from the free-delivery line up. */
export function SavingLine({ cents }: { cents: number }): React.JSX.Element | null {
  if (cents <= 0) return null;
  return (
    <p className="text-brand rise-in font-ui m-0 mt-1 flex items-baseline justify-between gap-3 text-[14.5px] font-semibold">
      <span>You&apos;re saving</span>
      <span>{formatUsd(cents)}</span>
    </p>
  );
}

/**
 * The bag's one goal under its charges, as the pill says it (bag-goal.ts; founder 2026-10-24: one bar, never two). Past
 * the free line, how the bulk saving grows from its own line ($99.99, D-187) and where it stops.
 */
function GoalMeter({ goal, bulkFrom }: { goal: BagGoal; bulkFrom: number | null }): React.JSX.Element | null {
  const every = (b: { perDollarCents: number | null; capCents: number }): string =>
    `every ${formatUsd(b.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(b.capCents)}`;
  const words =
    goal.kind === 'free-gap'
      ? `Add ${formatUsd(goal.leftCents)} more for free delivery`
      : goal.kind === 'free' && goal.bulk.capCents > 0
        ? goal.bulk.capped
          ? `You've unlocked the biggest bulk saving: ${formatUsd(goal.bulk.capCents)}`
          : goal.bulk.savingCents === 0 && bulkFrom !== null
            ? `From ${formatUsd(bulkFrom)}, ${every(goal.bulk)}`
            : `E${every(goal.bulk).slice(1)}`
        : null;
  if (!words || goal.kind === 'none') return null;
  return (
    <div className="mt-1.5 grid gap-2">
      <p className="m-0 text-[13px]">
        <span className="text-brand font-semibold">{words}</span>
      </p>
      <Meter share={goal.share} more={goal.kind === 'free' && goal.bulk.capCents > 0 ? goal.bulk.share : null} />
    </div>
  );
}

/**
 * The free-delivery pill's bar, in brand on cream (D-116), flaring when the bag grows; past the line its free part stays
 * full and the bulk saving fills the part after it (founder 2026-10-30).
 */
function Meter({ share, more }: { share: number; more: number | null }): React.JSX.Element {
  return <FreeMeter share={share} more={more} surge={useSurge(share + (more ?? 0))} tone="canvas" />;
}

/**
 * Checkout's summary before the server has priced the bag: the two charges as rows of its list, so the customer sees
 * them from the first step (D-112); the server prices them again with the address.
 */
export function PendingChargeRows(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  const days = useDays();
  if (!charges) return null;
  const { free, bulk, at, heavy } = freeDelivery(lines, charges, days);
  const saving = bagSaving(lines, charges, days);
  const row = (label: string, cents: number, struck = free) => (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0">
        <ChargeValue cents={cents} free={struck} />
      </dd>
    </div>
  );
  return (
    <>
      {row('Shipping', at.shippingCents || at.waivedShippingCents, at.shippingFree)}
      {at.retailerCents > 0 ? row('Retailer charges', at.retailerCents) : null}
      {heavy.cents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">Heavy-item shipping</dt>
          <dd className="m-0">
            <ReducedValue cents={heavy.cents} shownCents={heavy.shownCents} />
          </dd>
        </div>
      ) : null}
      {bulk.savingCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">Bulk saving</dt>
          <dd className="text-positive m-0">−{formatUsd(bulk.savingCents)}</dd>
        </div>
      ) : null}
      {saving > 0 ? (
        <div className="text-brand flex justify-between font-semibold">
          <dt>You&apos;re saving</dt>
          <dd className="m-0">{formatUsd(saving)}</dd>
        </div>
      ) : null}
    </>
  );
}

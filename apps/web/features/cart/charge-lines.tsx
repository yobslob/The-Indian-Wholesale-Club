'use client';

import { formatUsd } from '@repo/shared/domain';

import { freeDelivery, useBagCharges } from './charges';
import { FreeMeter, useSurge } from './free-delivery-bar';
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

/** D-123: the food weight's line: what it costs at this bag, and how much the bag's size already took off. */
export function foodWeightLabel(offPct: number): string {
  return offPct > 0 ? `Food weight (${offPct}% off)` : 'Food weight';
}

/**
 * The bag's Shipping and Retailer charges under its subtotal (D-111, D-123): the parcel's shipping and the retailer
 * charges are paid below the free-delivery line and struck through above it; the food weight is paid at every size,
 * less as the bag grows. Checkout prices them again on the server.
 */
export function ChargeLines(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, leftCents, line, share, bulk, at } = freeDelivery(lines, charges);
  const row = 'flex items-baseline justify-between gap-3 text-[14px]';
  return (
    <div className="font-ui grid gap-1" aria-live="polite">
      <p className={row}>
        <span>Shipping</span>
        <ChargeValue cents={at.shippingCents || at.waivedShippingCents} free={free} />
      </p>
      {at.foodFullCents > 0 ? (
        <p className={row}>
          <span>{foodWeightLabel(at.foodOffPct)}</span>
          <span>{formatUsd(at.foodCents)}</span>
        </p>
      ) : null}
      {at.retailerCents + at.waivedRetailerCents > 0 ? (
        <p className={row}>
          <span>Retailer charges</span>
          <ChargeValue cents={at.retailerCents || at.waivedRetailerCents} free={free} />
        </p>
      ) : null}
      {bulk.savingCents > 0 ? (
        <p className={row}>
          <span>Bulk saving</span>
          <span className="text-positive font-semibold">−{formatUsd(bulk.savingCents)}</span>
        </p>
      ) : null}
      {line !== null && !free ? (
        <div className="mt-1.5 grid gap-2">
          <p className="text-brand m-0 text-[13px] font-semibold">
            {at.foodFullCents > 0
              ? `Add ${formatUsd(leftCents)} more and Shipping comes off`
              : `Add ${formatUsd(leftCents)} more for free delivery`}
          </p>
          <Meter share={share} />
        </div>
      ) : null}
      {free ? <BulkHint bulk={bulk} /> : null}
    </div>
  );
}

/** D-119: from the line up, how the bulk saving grows and where it stops. */
function BulkHint({ bulk }: { bulk: ReturnType<typeof freeDelivery>['bulk'] }): React.JSX.Element | null {
  if (bulk.capCents === 0) return null;
  return (
    <div className="mt-1.5 grid gap-2">
      <p className="text-brand m-0 text-[13px] font-semibold">
        {bulk.capped
          ? `You've unlocked the biggest bulk saving: ${formatUsd(bulk.capCents)}`
          : `Every ${formatUsd(bulk.perDollarCents ?? 0)} more saves $1 more, up to ${formatUsd(bulk.capCents)}`}
      </p>
      <Meter share={bulk.share} />
    </div>
  );
}

/** The free-delivery pill's bar, in brand on cream (D-116), flaring when the bag grows. */
function Meter({ share }: { share: number }): React.JSX.Element {
  return <FreeMeter share={share} surge={useSurge(share)} tone="canvas" />;
}

/**
 * Checkout's summary before the server has priced the bag: the two charges as rows of its list, so the customer sees
 * them from the first step (D-112); the server prices them again with the address.
 */
export function PendingChargeRows(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, bulk, at } = freeDelivery(lines, charges);
  const row = (label: string, cents: number) => (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="m-0">
        <ChargeValue cents={cents} free={free} />
      </dd>
    </div>
  );
  return (
    <>
      {row('Shipping', at.shippingCents || at.waivedShippingCents)}
      {at.foodFullCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">{foodWeightLabel(at.foodOffPct)}</dt>
          <dd className="m-0">{formatUsd(at.foodCents)}</dd>
        </div>
      ) : null}
      {at.retailerCents + at.waivedRetailerCents > 0 ? row('Retailer charges', at.retailerCents || at.waivedRetailerCents) : null}
      {bulk.savingCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">Bulk saving</dt>
          <dd className="text-positive m-0">−{formatUsd(bulk.savingCents)}</dd>
        </div>
      ) : null}
    </>
  );
}

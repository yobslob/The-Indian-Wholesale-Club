'use client';

import { usePathname } from 'next/navigation';

import { formatUsd, quickMeter } from '@repo/shared/domain';

import { bagSaving, freeDelivery, undoBagChange, useBagCharges, useShipmentNote } from './charges';
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

/**
 * The bag's Shipping and Retailer charges under its subtotal (D-111, D-125): Shipping is at least the parcel's amount,
 * more when the bag's pieces cannot pay for the parcel; both are paid below the free-delivery line and struck through
 * above it. Checkout prices them again on the server.
 */
export function ChargeLines(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, leftCents, line, share, bulk, at } = freeDelivery(lines, charges);
  const row = 'flex items-baseline justify-between gap-3 text-[14px]';
  // D-154: the 7-day meter (the 7-day pieces against the 7-day line) above the free-delivery one
  const quick = quickMeter(charges.shipments);
  return (
    <div className="font-ui grid gap-1" aria-live="polite">
      <BagNote />
      <p className={row}>
        <span>Shipping</span>
        <ChargeValue cents={at.shippingCents || at.waivedShippingCents} free={at.shippingFree} />
      </p>
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
      {quick ? (
        <div className="mt-1.5 grid gap-2">
          <p className="text-brand m-0 text-[13px] font-semibold">
            7-day delivery: {formatUsd(quick.cents)} of {formatUsd(quick.minCents)}
          </p>
          <Meter share={quick.share} />
        </div>
      ) : null}
      {line !== null && !free ? (
        <div className="mt-1.5 grid gap-2">
          <p className="text-brand m-0 text-[13px] font-semibold">
            Add {formatUsd(leftCents)} more for free delivery
          </p>
          <Meter share={share} />
        </div>
      ) : null}
      {free ? <BulkHint bulk={bulk} /> : null}
      <SavingLine cents={bagSaving(lines, charges)} />
    </div>
  );
}

/**
 * D-154: the three-second note when a change moved the bag across a line, on the bag page (elsewhere the pill shows
 * it): "Your 7-day pieces now arrive by Fri, Oct 30", "Shipping is now $46.55 until $99.99. Undo".
 */
function BagNote(): React.JSX.Element | null {
  const note = useShipmentNote();
  const path = usePathname();
  if (!note || path !== '/cart') return null;
  return (
    <p className="text-brand rise-in m-0 mb-1 text-[13px] font-semibold">
      {note.text}{' '}
      {note.undo ? (
        <button type="button" onClick={() => undoBagChange(note.prevKey)} className="min-h-11 underline underline-offset-[3px]">
          Undo
        </button>
      ) : null}
    </p>
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

/** D-119: from the line up, how the bulk saving grows and where it stops. */
function BulkHint({
  bulk,
}: {
  bulk: ReturnType<typeof freeDelivery>['bulk'];
}): React.JSX.Element | null {
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
      {at.retailerCents + at.waivedRetailerCents > 0
        ? row('Retailer charges', at.retailerCents || at.waivedRetailerCents)
        : null}
      {bulk.savingCents > 0 ? (
        <div className="flex justify-between">
          <dt className="text-ink-muted">Bulk saving</dt>
          <dd className="text-positive m-0">−{formatUsd(bulk.savingCents)}</dd>
        </div>
      ) : null}
      {bagSaving(lines, charges) > 0 ? (
        <div className="text-brand flex justify-between font-semibold">
          <dt>You&apos;re saving</dt>
          <dd className="m-0">{formatUsd(bagSaving(lines, charges))}</dd>
        </div>
      ) : null}
    </>
  );
}

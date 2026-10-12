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

/**
 * The bag's Shipping and Retailer charges under its subtotal (D-111): charged below the free-delivery line, struck
 * through above it, with how much more makes them free. Checkout prices them again on the server.
 */
export function ChargeLines(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  if (!charges) return null;
  const { free, leftCents, line, share } = freeDelivery(lines, charges);
  const row = 'flex items-baseline justify-between gap-3 text-[14px]';
  return (
    <div className="font-ui grid gap-1" aria-live="polite">
      <p className={row}>
        <span>Shipping</span>
        <ChargeValue cents={charges.shippingCents} free={free} />
      </p>
      {charges.retailerCents > 0 ? (
        <p className={row}>
          <span>Retailer charges</span>
          <ChargeValue cents={charges.retailerCents} free={free} />
        </p>
      ) : null}
      {line !== null && !free ? (
        <div className="mt-1.5 grid gap-2">
          <p className="text-brand m-0 text-[13px] font-semibold">
            Add {formatUsd(leftCents)} more for free delivery
          </p>
          <Meter share={share} />
        </div>
      ) : null}
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
  const { free } = freeDelivery(lines, charges);
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
      {row('Shipping', charges.shippingCents)}
      {charges.retailerCents > 0 ? row('Retailer charges', charges.retailerCents) : null}
    </>
  );
}

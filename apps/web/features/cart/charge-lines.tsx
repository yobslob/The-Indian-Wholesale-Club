'use client';

import { formatUsd } from '@repo/shared/domain';

import { freeDelivery, useBagCharges } from './charges';
import { useCart } from './store';

/** "$19.79", or "$19.79" struck through and "Free" once the bag reaches the free-delivery line (D-111). */
export function ChargeValue({ cents, free }: { cents: number; free: boolean }): React.JSX.Element {
  if (cents === 0) return <span>Free</span>;
  return free ? (
    <span>
      <s className="text-ink-muted mr-1.5" aria-label={`was ${formatUsd(cents)}`}>
        {formatUsd(cents)}
      </s>
      Free
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
  const { free, leftCents, line } = freeDelivery(lines, charges);
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
        <p className="text-brand text-[13px] font-semibold">
          Add {formatUsd(leftCents)} more for free delivery
        </p>
      ) : null}
    </div>
  );
}

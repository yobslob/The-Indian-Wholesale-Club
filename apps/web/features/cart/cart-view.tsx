'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { bagShipmentState, formatUsd } from '@repo/shared/domain';

import { BagLines } from './bag-lines';
import { ChargeLines } from './charge-lines';
import { useBagCharges } from './charges';
import { cartSubtotalCents, useCart } from './store';

export const checkoutButton = 'bg-brand text-on-brand font-ui inline-grid h-[52px] place-items-center rounded-pill px-7 text-base font-semibold';

/** "Your bag is empty." with its link: the page and the panel both start with it. */
export function EmptyLine(): React.JSX.Element {
  return (
    <p className="text-ink m-0 text-base">
      Your bag is empty.{' '}
      <Link href="/states" className="underline underline-offset-[3px]">
        Find something from home
      </Link>
      .
    </p>
  );
}

/**
 * Subtotal, the small-order charges (D-111) and the line about what checkout adds (prices are indicative until the
 * server prices the bag, D-038).
 */
export function Subtotal(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  // D-154: a bag with 7-day pieces already shows its dates; the address confirms them at checkout
  const dated = bagShipmentState(useBagCharges()?.shipments ?? null) !== 'none';
  return (
    <div className="grid min-w-[240px] gap-2">
      <p className="font-ui m-0 flex items-baseline justify-between gap-3 text-base font-medium">
        Subtotal <b className="font-bold">{formatUsd(cartSubtotalCents(lines))}</b>
      </p>
      <ChargeLines />
      <small className="text-ink-muted font-body block text-[13px] font-normal">
        {dated ? 'Tax is added at checkout, where your address confirms the dates.' : 'Tax and delivery dates are shown at checkout.'}
      </small>
    </div>
  );
}

/**
 * The bag page (D-086): photo lines with − / + and the subtotal; an empty bag shows `empty` (the open states and Just
 * listed, drawn on the server) under its sentence, so it is never a dead end.
 */
export function CartView({ empty }: { empty: React.ReactNode }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0) {
    return (
      <div>
        <EmptyLine />
        {empty}
      </div>
    );
  }
  return (
    <div>
      <BagLines />
      {/* The totals and Checkout together under the prices' column (D-116): the eye ends where the button is. */}
      <div className="grid gap-4 pt-[22px] sm:ml-auto sm:max-w-[380px]">
        <Subtotal />
        <Link href="/checkout" className={`${checkoutButton} press w-full`}>
          Checkout
        </Link>
      </div>
    </div>
  );
}

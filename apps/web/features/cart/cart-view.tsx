'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { BagLines } from './bag-lines';
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

/** Subtotal with the line about what checkout adds (prices are indicative until the server prices the bag, D-038). */
export function Subtotal(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  return (
    <p className="font-ui m-0 text-base font-medium">
      Subtotal <b className="font-bold">{formatUsd(cartSubtotalCents(lines))}</b>
      <small className="text-ink-muted font-body mt-1 block text-[13px] font-normal">
        Shipping, tax and delivery dates are shown at checkout.
      </small>
    </p>
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
      <div className="flex flex-col items-stretch justify-between gap-4 pt-[22px] sm:flex-row sm:items-center">
        <Subtotal />
        <Link href="/checkout" className={checkoutButton}>
          Checkout
        </Link>
      </div>
    </div>
  );
}

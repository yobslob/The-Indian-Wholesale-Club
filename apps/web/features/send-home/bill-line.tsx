'use client';

import Link from 'next/link';

import { formatInr, formatUsd } from '@repo/shared/domain';

import { useGiftStore } from './gift-store';
import { useSavingView } from './use-gift';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.card;

/**
 * D-211: the bag's bill repeats where the 5% goes, under the total and outside the sum, so the card's figure and the
 * bill's own "You're saving" box never read as two discounts.
 */
export function SavingBillLine({ goodsCents }: { goodsCents: number | null }): React.JSX.Element | null {
  const view = useSavingView(goodsCents);
  if (!view) return null;
  const inr = view.inrPaise === null ? null : formatInr(view.inrPaise);
  const where = !view.sending || !inr ? W.billCoins(formatUsd(view.cents)) : view.person ? W.billTo(inr, view.person.name) : W.billPick(inr);
  return (
    <p className="border-line m-0 mt-3 flex items-baseline justify-between gap-3 rounded-[10px] border border-dashed px-3 py-2 text-[13px]">
      <span className="text-ink-muted">{W.bill}</span>
      <span className="text-ink text-right font-semibold">{where}</span>
    </p>
  );
}

/**
 * D-211: the bag's Checkout. With Send it home picked and nobody named yet, it opens "Who's it for?" first (its last line
 * is Keep it instead), so no one pays thinking their 5% goes home when it would go to Coins.
 */
export function CheckoutLink({ goodsCents, className, children }: { goodsCents: number | null; className: string; children: React.ReactNode }): React.JSX.Element {
  const view = useSavingView(goodsCents);
  const ask = useGiftStore((s) => s.ask);
  return (
    <Link
      href="/checkout"
      className={className}
      onClick={(e) => {
        if (view?.sending && !view.person) {
          e.preventDefault();
          ask(null, 'checkout');
        }
      }}
    >
      {children}
    </Link>
  );
}

'use client';

import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { useSavingView } from './use-gift';
import { SEND_HOME_WORDS } from './words';

import type { CheckoutQuote } from '@repo/shared/domain';

const W = SEND_HOME_WORDS.checkout;

/**
 * D-208: checkout's one quiet line above Pay: where the 5% saving goes, as the server priced it once it has (else as the
 * bag has it), with Change back to the bag's card. Nothing about it is in the bill.
 */
export function SavingLine({ quote, goodsCents }: { quote: CheckoutQuote | null; goodsCents: number | null }): React.JSX.Element | null {
  const view = useSavingView(goodsCents);
  const priced = quote?.saving;
  const cents = priced ? priced.cents : (view?.cents ?? 0);
  if (cents <= 0 || (quote && !priced)) return null;
  const name = priced ? (priced.to === 'home' ? priced.callName : null) : (view?.person?.name ?? null);
  const usd = formatUsd(cents);
  return (
    <p className="font-ui text-ink-muted mb-3 text-[13.5px]">
      {name ? W.toPerson(usd, name) : W.toCoins(usd)} ·{' '}
      <Link href="/cart" className="text-ink font-semibold underline underline-offset-[3px]">
        {W.change}
      </Link>
    </p>
  );
}

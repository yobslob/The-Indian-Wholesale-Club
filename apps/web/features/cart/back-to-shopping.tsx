'use client';

import Link from 'next/link';

import { shoppingPath } from './shopping-path';

const look =
  'border-brand text-brand font-ui rounded-pill inline-flex min-h-10 shrink-0 items-center whitespace-nowrap border px-3.5 text-[13px] font-semibold';

/**
 * D-192: beside every "Add $x more": back to where the customer was shopping. In the panel it just closes the panel, as the
 * shop is right behind it.
 */
export function BackToShopping({ onShop }: { onShop?: () => void }): React.JSX.Element {
  return onShop ? (
    <button type="button" onClick={onShop} className={look}>
      Back to shopping
    </button>
  ) : (
    <Link href={shoppingPath()} className={look}>
      Back to shopping
    </Link>
  );
}

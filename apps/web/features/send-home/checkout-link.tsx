'use client';

import Link from 'next/link';

import { useGiftStore } from './gift-store';
import { giftNeedsName } from './use-gift';

/**
 * The bag's Checkout (D-205, rule 7): a gift with no one named yet asks "Who's it for?" first; the sheet goes on to
 * checkout once it is filled or the gift is removed. Otherwise a plain link.
 */
export function CheckoutLink({ className, children }: { className: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Link
      href="/checkout"
      className={className}
      onClick={(e) => {
        if (!giftNeedsName()) return;
        e.preventDefault();
        useGiftStore.getState().ask(null, 'checkout');
      }}
    >
      {children}
    </Link>
  );
}

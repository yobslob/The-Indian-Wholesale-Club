'use client';

import { usePathname } from 'next/navigation';

import { isQuickPath } from '@/lib/site';

/**
 * D-154: the header's links for the store the shopper is in: the IWC store's types and States, or inside the 7-day
 * store (every page under /7-day-delivery) its own categories. Both sets are server-rendered; this only picks one, from
 * the address, so a cached page draws the right set with no flash.
 */
export function StoreLinks({ quick, children }: { quick: React.ReactNode; children: React.ReactNode }): React.JSX.Element {
  return <>{isQuickPath(usePathname()) ? quick : children}</>;
}

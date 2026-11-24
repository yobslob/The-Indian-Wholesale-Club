'use client';

import dynamic from 'next/dynamic';

import { useGiftStore } from './gift-store';

// PR-5: click-only, so the sheet's code loads when it opens, never with the bag
const WhoSheet = dynamic(() => import('./who-sheet').then((m) => m.WhoSheet), { ssr: false });

/** D-205: "Who's it for?", opened by a name on the card, Someone else, or Checkout with no one named yet. */
export function SheetHost(): React.JSX.Element | null {
  const asking = useGiftStore((s) => s.asking);
  return asking ? <WhoSheet relation={asking.relation} then={asking.then} /> : null;
}

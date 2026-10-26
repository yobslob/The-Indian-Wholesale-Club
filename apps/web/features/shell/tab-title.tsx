'use client';

import { useEffect } from 'react';

import { useCart } from '@/features/cart/store';

/** Claude's draft (D-161), shown only while the tab is in the background and the bag has a piece. */
const AWAY = 'Your chai’s going cold · your bag is waiting';

/**
 * D-161: a shopper who leaves with pieces in the bag sees the tab call them back, once, in the voice of home; the page's
 * own title returns the moment they come back. Nothing is sent or stored. No bag, no change.
 */
export function TabTitle(): null {
  const full = useCart((s) => s.lines.length > 0);
  useEffect(() => {
    if (!full) return;
    let own: string | null = null;
    const onChange = (): void => {
      if (document.hidden) {
        own = document.title;
        document.title = AWAY;
      } else if (own !== null) {
        document.title = own;
        own = null;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      if (own !== null) document.title = own;
    };
  }, [full]);
  return null;
}

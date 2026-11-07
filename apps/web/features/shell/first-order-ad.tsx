'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { isInfoPath } from '@/lib/site';

import type { ComponentType } from 'react';

/**
 * Pages where it would only get in the way: the bag has the coupon itself, the rest are forms or a customer's own pages.
 * A product page (/states/<state>/<piece>) has its photo where the ad would hang.
 */
const NOT_ON = /^\/((cart|checkout|login|signup|account|orders)(\/|$)|states\/[^/]+\/[^/]+)/;

const WAIT_MS = 3000;

/**
 * The first-order ad (founder 2026-11-07, D-193): three seconds after a page opens, wherever it is scrolled to, it comes down
 * from the navbar at the right edge, a different one by page; a tap or a swipe on it sends it back up. Only this much is in
 * every page: the drawings load the first time one is due (first-order-art.tsx), a static file, no database read and
 * nothing in the page cache.
 */
export function FirstOrderAd(): React.JSX.Element | null {
  const path = usePathname();
  const [due, setDue] = useState<{ path: string; Ad: ComponentType<{ path: string }> } | null>(null);

  useEffect(() => {
    if (NOT_ON.test(path) || isInfoPath(path)) return;
    let live = true;
    const timer = window.setTimeout(() => {
      import('./first-order-art')
        .then((m) => {
          if (live) setDue({ path, Ad: m.FirstOrderArt });
        })
        .catch(() => {
          // no ad this time: nothing on the page depends on it
        });
    }, WAIT_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [path]);

  if (!due || due.path !== path) return null;
  return <due.Ad key={path} path={path} />;
}

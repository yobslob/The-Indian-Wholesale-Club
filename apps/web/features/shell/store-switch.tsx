'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { isQuickPath, QUICK_HOME } from '@/lib/site';

/** Where the shopper last was in the IWC store, so its tab takes them back there (per tab, not per device). */
const LAST_IWC = 'iwc-last-store-page';

/**
 * The store tabs (D-154; founder 2026-10-24: the floating pill "looks so badly placed, do something creative with it"):
 * the two stores as two tabs on a dark strip along the very top of the page, like a browser's tabs. The store the
 * shopper is in is the open tab: it is the header's own colour and runs into it, so the header reads as the inside of
 * that store (ivory in the IWC store, a warm brand tint in the 7-day store with no line under its categories, founder
 * 2026-10-30). Founder 2026-10-30: the tabs read "IWC" and "7-day store", nothing under
 * them. The strip is in the page, never over it: it scrolls away with the first 40 px and the header stays
 * (globals.css, `--strip-h`); on Home it slides up as the hero's words fade. A tap opens the other store's front page
 * (the open tab moves at once, before the page arrives); the IWC tab returns to the page left. Plain links in a nav.
 */
export function StoreSwitch({
  mark,
}: {
  /** The IWC tab's India outline, drawn on the server (india-mark.tsx). */
  mark: React.ReactNode;
}): React.JSX.Element {
  const path = usePathname();
  const inQuick = isQuickPath(path);
  // The open tab moves on the tap, before the next page arrives.
  const [going, setGoing] = useState<boolean | null>(null);
  const [back, setBack] = useState('/');
  // Each change of store pops the 7 once (two names, so the animation restarts); none on the first paint.
  const [pop, setPop] = useState(0);
  const quick = going ?? inQuick;
  const shown = useRef(quick);

  useEffect(() => setGoing(null), [path]);
  useEffect(() => {
    // the address as the shopper sees it: usePathname gives a rewritten page's own route (/see-all/food/all/all/24/all
    // for /food, found 2026-10-30), a second copy of the page that nothing had read ahead
    const here = window.location.pathname + window.location.search;
    try {
      if (!inQuick) sessionStorage.setItem(LAST_IWC, here);
      setBack(inQuick ? (sessionStorage.getItem(LAST_IWC) ?? '/') : here);
    } catch {
      // storage blocked: the IWC tab opens Home
      setBack(inQuick ? '/' : here);
    }
  }, [path, inQuick]);
  useEffect(() => {
    if (shown.current === quick) return;
    shown.current = quick;
    setPop((g) => g + 1);
  }, [quick]);

  const tab = (toQuick: boolean): React.JSX.Element => {
    const open = quick === toQuick;
    return (
      <Link
        href={toQuick ? QUICK_HOME : back}
        aria-current={open ? 'page' : undefined}
        className="store-tab"
        onClick={() => {
          if (toQuick !== inQuick) setGoing(toQuick);
        }}
      >
        {toQuick ? (
          <span className="store-tab-mark" aria-hidden="true">
            7
          </span>
        ) : (
          <span className="store-tab-mark" data-iwc="" aria-hidden="true">
            {mark}
          </span>
        )}
        <span className="store-tab-name">{toQuick ? '7-day store' : 'IWC'}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Store"
      className="store-strip font-ui"
      data-store={quick ? 'quick' : 'iwc'}
      data-pop={pop === 0 ? undefined : pop % 2 ? 'a' : 'b'}
    >
      <div className="store-tabs">
        <span className="store-open" aria-hidden="true" />
        {tab(false)}
        {tab(true)}
      </div>
    </nav>
  );
}

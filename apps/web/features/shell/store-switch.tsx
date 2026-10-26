'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { datesIn, dayName, formatDeliveryWindow, quickArrivesLine } from '@repo/shared/domain';

import { isQuickPath, QUICK_HOME } from '@/lib/site';

/**
 * D-161 (the homesick plan): each tab says when its store is at your door. The 7-day one by day name ("Saturday at
 * your door": a weekday beats a number), the IWC one by date ("at your door by Nov 11", the standard days); without
 * the standard days (cycle mode) it keeps "All 36 states".
 */
export function tabLines(
  quick: { min: number; max: number },
  standard: { min: number; max: number } | null,
  now?: Date,
): { quick: string; iwc: string } {
  const q = datesIn(quick.min, quick.max, now);
  const s = standard ? datesIn(standard.min, standard.max, now) : null;
  return {
    quick: q.from === q.to ? `${dayName(q.to)} at your door` : quickArrivesLine(quick.min, quick.max, now),
    iwc: s ? `at your door by ${formatDeliveryWindow(s.to, s.to)}` : 'All 36 states',
  };
}

/** Where the shopper last was in the IWC store, so its tab takes them back there (per tab, not per device). */
const LAST_IWC = 'iwc-last-store-page';

/**
 * The store tabs (D-154; founder 2026-10-24: the floating pill "looks so badly placed, do something creative with it"):
 * the two stores as two tabs on a dark strip along the very top of the page, like a browser's tabs. The store the
 * shopper is in is the open tab: it is the header's own colour and runs into it, so the header reads as the inside of
 * that store (ivory in the IWC store, a warm brand tint in the 7-day store, where the header's bottom edge turns to the
 * jewellery drawer's gold stitch, D-144). Each tab says when its store is at your door (tabLines, D-161), worked out
 * in the browser so a cached page never shows yesterday's. The strip is in the page, never over it: it scrolls away with the first 40 px and the header stays
 * (globals.css, `--strip-h`); on Home it slides up as the hero's words fade. A tap opens the other store's front page
 * (the open tab moves at once, before the page arrives); the IWC tab returns to the page left. Plain links in a nav.
 */
export function StoreSwitch({
  quick: quickDays,
  standard,
  mark,
}: {
  quick: { min: number; max: number };
  standard: { min: number; max: number } | null;
  /** The IWC tab's India outline, drawn on the server (india-mark.tsx). */
  mark: React.ReactNode;
}): React.JSX.Element {
  const path = usePathname();
  const inQuick = isQuickPath(path);
  // The open tab moves on the tap, before the next page arrives.
  const [going, setGoing] = useState<boolean | null>(null);
  // the lines as the server wrote them; replaced once the browser knows today's date
  const [lines, setLines] = useState(() => tabLines(quickDays, standard));
  const [back, setBack] = useState('/');
  // Each change of store pops the 7 once (two names, so the animation restarts); none on the first paint.
  const [pop, setPop] = useState(0);
  const quick = going ?? inQuick;
  const shown = useRef(quick);

  useEffect(() => setGoing(null), [path]);
  useEffect(() => setLines(tabLines(quickDays, standard)), [quickDays, standard]);
  useEffect(() => {
    try {
      if (!inQuick) sessionStorage.setItem(LAST_IWC, path + window.location.search);
      else setBack(sessionStorage.getItem(LAST_IWC) ?? '/');
    } catch {
      // storage blocked: the IWC tab opens Home
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
        href={toQuick ? QUICK_HOME : inQuick ? back : path}
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
        <span className="store-tab-words">
          <span className="store-tab-name">{toQuick ? '7-day store' : 'IWC store'}</span>
          <span className="store-tab-line" suppressHydrationWarning>
            {toQuick ? lines.quick : lines.iwc}
          </span>
        </span>
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { quickArrivesLine } from '@repo/shared/domain';

import { isQuickPath, QUICK_HOME } from '@/lib/site';

/** Where the shopper last was in the IWC store, so its tab takes them back there (per tab, not per device). */
const LAST_IWC = 'iwc-last-store-page';

/**
 * The store switch (D-154): one pill, "IWC store" and "7-day store", with a thumb that slides to the store the shopper
 * is in: light paper in the IWC store, the brand colour in the 7-day store (and the header's bottom edge turns to the
 * gold stitch, CSS in globals.css). Under "7-day store", the live date ("arrives by Fri, Oct 30") from the 7-day days
 * in Settings, worked out in the browser so a cached page never shows yesterday's. A tap opens the other store's front
 * page; the IWC tab returns to the page left. Keyboard: one tab list, ← and → move. Phones: "IWC" and "7-day".
 */
export function StoreSwitch({
  daysMin,
  daysMax,
  arrives,
}: {
  daysMin: number;
  daysMax: number;
  /** The line as the server wrote it; replaced once the browser knows today's date. */
  arrives: string;
}): React.JSX.Element {
  const path = usePathname();
  const inQuick = isQuickPath(path);
  // The thumb moves on the tap, before the next page arrives.
  const [going, setGoing] = useState<boolean | null>(null);
  const [line, setLine] = useState(arrives);
  const [back, setBack] = useState('/');
  // Each change of store glows the thumb once (two names, so the animation restarts); none on the first paint.
  const [glow, setGlow] = useState(0);
  const tabs = useRef<(HTMLAnchorElement | null)[]>([]);
  const quick = going ?? inQuick;
  const shown = useRef(quick);

  useEffect(() => setGoing(null), [path]);
  useEffect(() => setLine(quickArrivesLine(daysMin, daysMax)), [daysMin, daysMax]);
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
    setGlow((g) => g + 1);
  }, [quick]);

  const tab = (toQuick: boolean, i: number, long: string, short: string): React.JSX.Element => {
    const selected = quick === toQuick;
    return (
      <Link
        ref={(el) => {
          tabs.current[i] = el;
        }}
        href={toQuick ? QUICK_HOME : inQuick ? back : path}
        role="tab"
        aria-selected={selected}
        tabIndex={selected ? 0 : -1}
        className="store-tab"
        onClick={() => {
          if (toQuick !== inQuick) setGoing(toQuick);
        }}
      >
        <span className="store-tab-name">
          <span className="hidden md:inline">{long}</span>
          <span className="md:hidden">{short}</span>
        </span>
        {toQuick ? <small className="store-tab-date">{line}</small> : null}
      </Link>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Store"
      className="store-switch font-ui"
      data-store={quick ? 'quick' : 'iwc'}
      data-glow={glow === 0 ? undefined : glow % 2 ? 'a' : 'b'}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        tabs.current[e.key === 'ArrowRight' ? 1 : 0]?.focus();
      }}
    >
      <span className="store-thumb" aria-hidden="true" />
      {tab(false, 0, 'IWC store', 'IWC')}
      {tab(true, 1, '7-day store', '7-day')}
    </div>
  );
}

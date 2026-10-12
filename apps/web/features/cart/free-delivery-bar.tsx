'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { freeDelivery, useBagCharges } from './charges';
import { cartCount, useCart } from './store';

/**
 * The free-delivery pill (D-111, D-116): once a piece is in the bag, a slim pill floats at the bottom of every store
 * page with the newest photo and the bag's count, how much more unlocks free delivery, and the pill itself as the
 * meter: a soft light fills it from the left, its edge glowing, and flares each time the bag grows. At the line the
 * light fills the pill and a sheen runs across once. A tap opens the bag. Not on the bag page, which shows the same
 * meter in its summary. The look is `.fd-*` in globals.css.
 */
export function FreeDeliveryBar(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  const path = usePathname();
  const [shown, setShown] = useState(false);
  const visible =
    lines.length > 0 && charges !== null && charges.freeMinCents !== null && path !== '/cart';
  useEffect(() => {
    if (!visible) return setShown(false);
    const frame = requestAnimationFrame(() => setShown(true));
    // Room under the page so the pill never covers the footer's last line (globals.css).
    document.documentElement.dataset.freeBar = '';
    return () => {
      cancelAnimationFrame(frame);
      delete document.documentElement.dataset.freeBar;
    };
  }, [visible]);

  const { free, leftCents, share } = visible
    ? freeDelivery(lines, charges)
    : { free: false, leftCents: 0, share: 0 };
  const surge = useSurge(share);
  if (!visible) return null;

  const count = cartCount(lines);
  const newest = lines[lines.length - 1];
  return (
    <Link
      href="/cart"
      aria-live="polite"
      className={`fd-pill bg-brand text-on-brand font-ui fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[44] mx-auto flex h-14 max-w-[440px] items-center gap-3 rounded-pill pl-2 pr-4 [html[data-buy-bar]_&]:bottom-[84px] md:[html[data-buy-bar]_&]:bottom-[max(12px,env(safe-area-inset-bottom))] ${
        shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-5 scale-[.96] opacity-0'
      }`}
      data-free={free || undefined}
    >
      <span className="fd-fill" aria-hidden="true" style={{ '--fd': free ? 1 : Math.max(share, 0.04) } as React.CSSProperties}>
        <i key={surge} className="fd-edge" data-surge={surge > 0 || undefined} />
      </span>
      {free ? <span key="sheen" className="fd-sheen" aria-hidden="true" /> : null}
      <span className="bg-paper relative z-[1] grid size-10 flex-none place-items-center overflow-visible rounded-full">
        {newest?.imagePath ? (
          <span className="absolute inset-0 overflow-hidden rounded-full">
            <Image src={mediaUrl(newest.imagePath)} alt="" fill sizes="40px" className="object-cover" />
          </span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="text-brand size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8h14l-1 13H6L5 8z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
        )}
        <b key={count} aria-hidden="true" className="fd-count bg-ink text-paper absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none ring-2 ring-brand">
          {count}
        </b>
      </span>
      <span className="relative z-[1] min-w-0 flex-1 truncate text-[13.5px] font-medium leading-none sm:text-[14.5px]">
        {free ? (
          <>
            <b className="font-bold tracking-[0.02em]">FREE DELIVERY</b> unlocked
          </>
        ) : (
          <>
            Add <b className="font-bold">{formatUsd(leftCents)}</b> more <span className="sm:hidden">for</span>
            <span className="hidden sm:inline">to unlock</span>{' '}
            <b className="font-bold tracking-[0.02em]">FREE DELIVERY</b>
          </>
        )}
        <span className="sr-only">
          . Bag, {count} {count === 1 ? 'item' : 'items'}
        </span>
      </span>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="relative z-[1] size-4 flex-none fill-none stroke-current stroke-[2.4] opacity-80">
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/** A number that goes up each time `share` grows, so the meter's edge can flare once per add (not on the first draw). */
export function useSurge(share: number): number {
  const last = useRef<number | null>(null);
  const [surge, setSurge] = useState(0);
  useEffect(() => {
    if (last.current !== null && share > last.current + 0.001) setSurge((n) => n + 1);
    last.current = share;
  }, [share]);
  return surge;
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatUsd, type BagGoal } from '@repo/shared/domain';

import { deliveryDaysLabel } from '@/features/catalog/delivery-days';
import { StorePhoto } from '@/features/catalog/store-photo';
import { useDays } from '@/features/shell/days';
import { mediaUrl } from '@/lib/site';

import { freeDelivery, useBagCharges } from './charges';
import { FreeMeter, useSurge } from './free-meter';
import { cartCount, useCart, type CartLine } from './store';


/**
 * The free-delivery pill (D-111, D-116): once a piece is in the bag, a slim pill floats at the bottom of every store
 * page with the newest photo and the bag's count, how much more unlocks free delivery and, under that line, a bar
 * that fills with light: a glowing head, a shimmer running through the filled part, a flare each time the bag grows.
 * At the line the bar is full and a sheen runs across the pill once; from there the bar fills again with the bulk
 * saving until its cap (D-119, from $99.99, D-187). A tap opens the bag. Not on the bag page, which shows the same bars
 * in its summary. One goal, one bar (founder, 2026-10-24; bag-goal.ts).
 * D-161 (the homesick plan): the bar is a flight path, India to a little house, "$12.40 more and the flight's on us",
 * and each add says "Coming home in 7 delivery days" for three seconds. The look is `.fd-*` in globals.css.
 * Founder 2026-10-30: the goal is picked from the bag as it is now, from its first draw (charges.ts, bag-goal.ts), and
 * past the free line the bar keeps its full part to the house while the pill grows a second part for the bulk saving.
 */
export function FreeDeliveryBar(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const charges = useBagCharges();
  const days = useDays();
  const path = usePathname();
  const [shown, setShown] = useState(false);
  // after the first paint only: the bag and the last charges live on the device, the server draws no pill
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // 2026-10-30: the pill comes with the add, not with the charges' answer; its words follow when the answer is in
  const visible =
    mounted &&
    lines.length > 0 &&
    (charges === null || charges.freeMinCents !== null) &&
    path !== '/cart';
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

  const goal: BagGoal = visible ? freeDelivery(lines, charges, days).goal : { kind: 'none' };
  const free = goal.kind === 'free';
  // past the free line: the bulk saving's part after the house (null: no such part)
  const more = goal.kind === 'free' && goal.bulk.capCents > 0 ? goal.bulk.share : null;
  const surge = useSurge(goal.kind === 'none' ? 0 : goal.share + (more ?? 0));
  const count = cartCount(lines);
  const newest = lines[lines.length - 1];
  const home = useComingHome(count, newest);
  if (!visible) return null;

  return (
    <Link
        href="/cart"
        className={`fd-pill bg-brand text-on-brand font-ui rounded-pill fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[44] mx-auto flex h-14 ${more === null ? 'max-w-[440px]' : 'max-w-[520px]'} items-center gap-3 pl-2 pr-4 [html[data-buy-bar]_&]:bottom-[84px] md:[html[data-buy-bar]_&]:bottom-[max(12px,env(safe-area-inset-bottom))] ${
          shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-5 scale-[.96] opacity-0'
        }`}
        data-free={free || undefined}
      >
        {free ? <span key="sheen" className="fd-sheen" aria-hidden="true" /> : null}
        <span className="bg-paper relative z-[1] grid size-10 flex-none place-items-center overflow-visible rounded-full">
          {newest?.imagePath ? (
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <StorePhoto
                src={mediaUrl(newest.imagePath)}
                alt=""
                sizes="40px"
                className="object-cover"
              />
            </span>
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="text-brand size-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8h14l-1 13H6L5 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
          )}
          <b
            key={count}
            aria-hidden="true"
            className="fd-count bg-ink text-paper ring-brand absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none ring-2"
          >
            {count}
          </b>
        </span>
        <span className="relative z-[1] grid min-w-0 flex-1 gap-[7px]">
          {/* launch QA B-11: only the words are live (one sentence read out), not the bar and its "$ $ $ $" picture */}
          <span aria-live="polite" className="truncate text-[13.5px] font-medium leading-none sm:text-[14.5px]">
            {home ? (
              <span key={home.key} className="rise-in inline-block">
                Coming home <b className="font-bold">in {home.days}</b>
              </span>
            ) : goal.kind !== 'none' ? (
              <GoalWords goal={goal} />
            ) : (
              <>{count} in your bag</>
            )}
            <span className="sr-only">
              . Bag, {count} {count === 1 ? 'item' : 'items'}
            </span>
          </span>
          <FreeMeter share={goal.kind === 'none' ? 0 : goal.share} more={more} surge={surge} />
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="relative z-[1] size-4 flex-none fill-none stroke-current stroke-[2.4] opacity-80"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
    </Link>
  );
}

/** The pill's one line for the bag's goal ("$12.40 more and the flight's on us", "FREE DELIVERY + saving $1.40", …). */
function GoalWords({ goal }: { goal: BagGoal }): React.JSX.Element | null {
  const big = (words: string) => <b className="font-bold tracking-[0.02em]">{words}</b>;
  switch (goal.kind) {
    case 'free-gap':
      return (
        // D-161: the homesick plan's words; "free delivery" stays for screen readers and the bag's own line
        <>
          <b className="font-bold">{formatUsd(goal.leftCents)}</b> more and the flight&rsquo;s on us
          <span className="sr-only"> (free delivery)</span>
        </>
      );
    case 'free':
      // D-119: past the line the bulk saving fills its own part of the bar, up to its cap; free delivery stays said
      if (goal.bulk.capped)
        return (
          <>
            {big('FREE DELIVERY')} + <b className="font-bold">{formatUsd(goal.bulk.capCents)}</b> off, the biggest saving
          </>
        );
      if (goal.bulk.savingCents > 0)
        return (
          <>
            {big('FREE DELIVERY')} + saving <b className="font-bold">{formatUsd(goal.bulk.savingCents)}</b>
          </>
        );
      return (
        <>
          {big('FREE DELIVERY')} · the flight&rsquo;s on us
        </>
      );
    default:
      return null;
  }
}

/**
 * "Coming home in 7 delivery days" for three seconds after each add (the plan's toast, D-161, D-187): the newest piece's
 * delivery days from Settings. Nothing on the first draw.
 */
function useComingHome(count: number, newest: CartLine | undefined): { key: number; days: string } | null {
  const { food, standard } = useDays();
  const last = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [key, setKey] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    // The first draw shows the server's empty bag: the bag already on this device is where it starts, not an add
    // (2026-10-30: every page load said "Coming home" for three seconds)
    if (last.current === null) {
      last.current = cartCount(useCart.getState().lines);
      return;
    }
    // its own timer, so taking a piece out within the three seconds does not leave the line up for good
    if (count > last.current) {
      setKey((k) => k + 1);
      setOn(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOn(false), 3200);
    }
    last.current = count;
  }, [count]);
  if (!on || !newest) return null;
  const d = newest.productType === 'food' ? food : standard;
  const days = deliveryDaysLabel(d?.min, d?.max);
  return days ? { key, days } : null;
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { bagShipmentState, datesIn, dayName, doorDate, formatUsd, type BagGoal } from '@repo/shared/domain';

import { StorePhoto } from '@/features/catalog/store-photo';
import { useDays } from '@/features/shell/days';
import { mediaUrl } from '@/lib/site';

import { freeDelivery, undoBagChange, useBagCharges, useShipmentNote } from './charges';
import { cartCount, useCart, type CartLine } from './store';

import type { BagCharges } from './charges';

/**
 * The free-delivery pill (D-111, D-116): once a piece is in the bag, a slim pill floats at the bottom of every store
 * page with the newest photo and the bag's count, how much more unlocks free delivery and, under that line, a bar
 * that fills with light: a glowing head, a shimmer running through the filled part, a flare each time the bag grows.
 * At the line the bar is full and a sheen runs across the pill once; from there the bar fills again with the bulk
 * saving until its cap (D-119). A tap opens the bag. Not on the bag page, which shows the same bars in its summary.
 * One goal, one bar (founder, 2026-10-24; bag-goal.ts): a bag of only 7-day pieces works towards free 7-day delivery
 * ($49.99) and, there, says it is free as checkout does; every other bag towards free delivery. D-154: when a change
 * moves the bag across a line the pill says so for three seconds, with Undo beside it when a normal piece brought
 * Shipping back.
 * D-161 (the homesick plan): the bar is a flight path, India to a little house, "$12.40 more and the flight's on us",
 * and each add says "Coming home Sat, Oct 31" for three seconds. The look is `.fd-*` in globals.css.
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

  const goal: BagGoal = visible ? freeDelivery(lines, charges).goal : { kind: 'none' };
  const free = goal.kind === 'free' || goal.kind === 'quick-free';
  const surge = useSurge(goal.kind === 'none' ? 0 : goal.share);
  const note = useShipmentNote();
  const count = cartCount(lines);
  const newest = lines[lines.length - 1];
  const home = useComingHome(count, newest, charges);
  if (!visible) return null;

  return (
    <>
      <Link
        href="/cart"
        aria-live="polite"
        className={`fd-pill bg-brand text-on-brand font-ui rounded-pill fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[44] mx-auto flex h-14 max-w-[440px] items-center gap-3 pl-2 pr-4 [html[data-buy-bar]_&]:bottom-[84px] md:[html[data-buy-bar]_&]:bottom-[max(12px,env(safe-area-inset-bottom))] ${
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
          <span className="truncate text-[13.5px] font-medium leading-none sm:text-[14.5px]">
            {note ? (
              <span key={note.until} className="rise-in inline-block">
                {note.text}
              </span>
            ) : home ? (
              <span key={home.key} className="rise-in inline-block">
                Coming home <b className="font-bold">{home.date}</b>
              </span>
            ) : (
              <GoalWords goal={goal} />
            )}
            <span className="sr-only">
              . Bag, {count} {count === 1 ? 'item' : 'items'}
            </span>
          </span>
          <FreeMeter share={goal.kind === 'none' ? 0 : goal.share} surge={surge} />
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="relative z-[1] size-4 flex-none fill-none stroke-current stroke-[2.4] opacity-80"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Link>
      {note?.undo ? (
        // Beside the pill, not inside it: the pill is a link to the bag
        <button
          type="button"
          onClick={() => undoBagChange(note.prevKey)}
          className="bg-paper text-ink border-line font-ui rounded-pill rise-in fixed bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)] right-[max(12px,calc(50%-208px))] z-[44] min-h-11 border px-4 text-[14px] font-semibold shadow-sm [html[data-buy-bar]_&]:bottom-[160px] md:[html[data-buy-bar]_&]:bottom-[calc(max(12px,env(safe-area-inset-bottom))+76px)]"
        >
          Undo
        </button>
      ) : null}
    </>
  );
}

/** The pill's one line for the bag's goal ("Add $12.40 more for FREE 7-DAY DELIVERY", "FREE DELIVERY unlocked", …). */
function GoalWords({ goal }: { goal: BagGoal }): React.JSX.Element | null {
  const big = (words: string) => <b className="font-bold tracking-[0.02em]">{words}</b>;
  switch (goal.kind) {
    case 'quick-gap':
      return (
        <>
          <b className="font-bold">{formatUsd(goal.leftCents)}</b> more for {big('FREE 7-DAY DELIVERY')}
        </>
      );
    case 'quick-free':
      return (
        <>
          {big('FREE 7-DAY DELIVERY')}
          {goal.arrivesByDay ? <> · home by {dayName(goal.arrivesByDay)}</> : ' unlocked'}
        </>
      );
    case 'free-gap':
      return (
        // D-161: the homesick plan's words; "free delivery" stays for screen readers and the bag's own line
        <>
          <b className="font-bold">{formatUsd(goal.leftCents)}</b> more and the flight&rsquo;s on us
          <span className="sr-only"> (free delivery)</span>
        </>
      );
    case 'free':
      // D-119: past the line the bar shows the bulk saving filling up to its cap
      if (goal.bulk.capped)
        return (
          <>
            <b className="font-bold">{formatUsd(goal.bulk.capCents)}</b> off: {big('BIGGEST SAVING')}
          </>
        );
      if (goal.bulk.savingCents > 0)
        return (
          <>
            Saving <b className="font-bold">{formatUsd(goal.bulk.savingCents)}</b>
            <span className="hidden sm:inline"> · add more, save more</span>
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
 * The free-delivery bar (D-116): a track with a fill up to `share`, a glowing head at its end and a shimmer running
 * through the filled part; `surge` (from useSurge) flares the head once per add. `tone` "canvas" is the bag summary's
 * brand-on-cream version of the pill's light-on-brand one.
 */
export function FreeMeter({
  share,
  surge,
  tone = 'brand',
  route = true,
}: {
  share: number;
  surge: number;
  tone?: 'brand' | 'canvas';
  /** The flight path's ends: India and the house (D-161). */
  route?: boolean;
}): React.JSX.Element {
  const full = share >= 1;
  const bar = (
    <span
      className="fd-bar"
      data-tone={tone}
      data-full={full || undefined}
      aria-hidden="true"
      style={{ '--fd': full ? 1 : Math.max(share, 0.04) } as React.CSSProperties}
    >
      <span className="fd-fill" />
      <i key={surge} className="fd-head" data-surge={surge > 0 || undefined} />
    </span>
  );
  if (!route) return bar;
  // D-161 (the plan's flight path): from the India outline (the layout's #india-mark) along the stitch to a house
  return (
    <span className="fd-route" data-tone={tone} data-full={full || undefined} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="fd-end">
        <use href="#india-mark" />
      </svg>
      {bar}
      <svg viewBox="0 0 24 24" className="fd-end" data-house="">
        <path d="M4 11.5 12 4l8 7.5M6.5 9.5V20h11V9.5M10 20v-5h4v5" />
      </svg>
    </span>
  );
}

/**
 * "Coming home Sat, Oct 31" for three seconds after each add (the plan's toast, D-161): the newest piece's date as the
 * bag's own answer says it (its 7-day date when it travels in the 7-day shipment, else the standard window), or the
 * standard days from Settings before that answer is in. Nothing on the first draw.
 */
function useComingHome(count: number, newest: CartLine | undefined, charges: BagCharges | null): { key: number; date: string } | null {
  const { standard } = useDays();
  const last = useRef<number | null>(null);
  const [key, setKey] = useState(0);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (last.current !== null && count > last.current) {
      setKey((k) => k + 1);
      setOn(true);
      const t = setTimeout(() => setOn(false), 3200);
      last.current = count;
      return () => clearTimeout(t);
    }
    last.current = count;
  }, [count]);
  if (!on || !newest) return null;
  const f = charges?.shipments ?? null;
  const state = bagShipmentState(f);
  const inQuick = f !== null && (state === 'quick' || state === 'split') && f.quickIds.includes(newest.variantId);
  const from = inQuick ? f.dates.quickFrom : f?.dates.standardFrom;
  const to = inQuick ? f.dates.quickTo : f?.dates.standardTo;
  if (from && to) return { key, date: doorDate(from, to) };
  if (!standard) return null;
  const d = datesIn(standard.min, standard.max);
  return { key, date: doorDate(d.from, d.to) };
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

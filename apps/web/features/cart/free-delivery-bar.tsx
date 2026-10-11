'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { freeDelivery, useBagCharges } from './charges';
import { cartCount, useCart } from './store';

/**
 * The free-delivery bar (D-111): once a piece is in the bag, a card floats at the bottom of every store page with how
 * much more unlocks free delivery, a progress line, the bag's count and its newest photo; a tap opens the bag. At the
 * line it says free delivery is unlocked. Not on the bag page itself, which shows the same in its summary.
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
    // Room under the page so the bar never covers the footer's last line (globals.css).
    document.documentElement.dataset.freeBar = '';
    return () => {
      cancelAnimationFrame(frame);
      delete document.documentElement.dataset.freeBar;
    };
  }, [visible]);
  if (!visible) return null;

  const { free, leftCents, share } = freeDelivery(lines, charges);
  const count = cartCount(lines);
  const newest = lines[lines.length - 1];
  return (
    <Link
      href="/cart"
      aria-live="polite"
      className={`bg-brand text-on-brand font-ui fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[44] mx-auto block max-w-[640px] rounded-[18px] px-4 pb-3 pt-3 shadow-[0_10px_30px_rgba(30,27,22,.28)] transition-[transform,opacity,bottom] duration-300 ease-[cubic-bezier(.2,.7,.2,1)] sm:px-5 [html[data-buy-bar]_&]:bottom-[88px] md:[html[data-buy-bar]_&]:bottom-[max(12px,env(safe-area-inset-bottom))] ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-tight sm:text-[17px]">
          {free ? (
            <>
              <b className="font-bold">FREE DELIVERY</b> unlocked
            </>
          ) : (
            <>
              Add {formatUsd(leftCents)} more to unlock <b className="font-bold">FREE DELIVERY</b>
            </>
          )}
        </span>
        <span className="flex flex-none items-center gap-2.5">
          <span className="text-right leading-tight">
            <b className="block text-[15px] font-bold tracking-[0.04em] sm:text-[17px]">BAG</b>
            <small className="block text-[12px] font-medium opacity-85">
              {count} {count === 1 ? 'ITEM' : 'ITEMS'}
            </small>
          </span>
          {newest?.imagePath ? (
            <span className="bg-paper relative block h-11 w-9 overflow-hidden rounded-[6px]">
              <Image
                src={mediaUrl(newest.imagePath)}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
              />
            </span>
          ) : null}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 fill-none stroke-current stroke-[2.4]"
          >
            <path d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </span>
      <span
        className="mt-2.5 block h-[5px] overflow-hidden rounded-full bg-white/25"
        aria-hidden="true"
      >
        <i
          className="block h-full rounded-full bg-white transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(share * 100, 4)}%` }}
        />
      </span>
    </Link>
  );
}

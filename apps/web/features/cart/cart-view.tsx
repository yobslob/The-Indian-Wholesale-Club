'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useMoney } from '@/features/shell/market';

import { BagGoalLine } from './bag-goal-line';
import { BagLines } from './bag-lines';
import { BillCard, billTotalLabel } from './bill-card';
import { useBagCharges } from './charges';
import { CouponCard } from './coupon-card';
import { useCart } from './store';
import { useBagBill, type BagBill } from './use-bag-bill';

export const checkoutButton = 'bg-brand text-on-brand font-ui inline-grid h-[52px] place-items-center rounded-pill px-7 text-base font-semibold';

/** The empty bag's line with its link (D-161, the founder's pick of the plan's words): the page and the panel both start with it. */
export function EmptyLine(): React.JSX.Element {
  return (
    <p className="text-ink m-0 text-base">
      Lighter than a tiffin.{' '}
      <Link href="/states" className="underline underline-offset-[3px]">
        Let&rsquo;s fix that
      </Link>
      .
    </p>
  );
}

/** D-192: the goal, the coupons and the bill, in that order, on the bag page and in the panel alike. */
export function BagExtras({ bag, onShop }: { bag: BagBill; onShop?: () => void }): React.JSX.Element {
  const charges = useBagCharges();
  const free = charges?.freeMinCents ?? null;
  return (
    <div className="grid gap-3">
      <BagGoalLine couponOn={bag.coupon !== null} onShop={onShop} />
      <CouponCard bag={bag} freeGap={free !== null && bag.subtotalCents < free} onShop={onShop} />
      <BillCard bill={bag.bill} subtotalCents={bag.subtotalCents} updating={bag.updating} signInHref={bag.offers?.coins === null ? '/login?next=/cart' : undefined} />
    </div>
  );
}

/** What the last line of the bill says and how far it has got; Subtotal until the charges are in. */
export function TotalNow({ bag }: { bag: BagBill }): React.JSX.Element {
  const { format: fmt } = useMoney();
  return (
    <span className="font-ui block leading-tight">
      <small className="text-ink-muted block text-[12.5px]">{bag.bill ? billTotalLabel(bag.bill) : 'Subtotal'}</small>
      <b className="text-[17px] font-bold">{fmt(bag.bill?.totalCents ?? bag.subtotalCents)}</b>
    </span>
  );
}

/**
 * The bag's shape while the page wakes up (launch QA B-10): the bag lives on the device, so the server draws no lines.
 * Two quiet line shapes instead of "Loading your bag…", which flashed for about a second on every visit; no words.
 */
function BagSkeleton(): React.JSX.Element {
  const block = 'bg-land/70 motion-safe:animate-pulse rounded-md';
  return (
    <div aria-busy="true" className="border-line border-t">
      <span className="sr-only">Opening your bag</span>
      {[0, 1].map((i) => (
        <div key={i} aria-hidden="true" className="border-line flex items-center gap-5 border-b py-4">
          <div className={`${block} aspect-[3/4] w-16 rounded-xl sm:w-[72px]`} />
          <div className="flex-1 space-y-2">
            <div className={`${block} h-4 w-3/5`} />
            <div className={`${block} h-3.5 w-2/5`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The bag page (D-086, D-192): the lines in their cards; the goal, coupons and bill beside them on wide screens and under
 * them on a phone, where the total and Checkout stay under the thumb. An empty bag shows `empty` (the open states and Just
 * listed, drawn on the server) under its sentence, so it is never a dead end.
 */
export function CartView({ empty }: { empty: React.ReactNode }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <BagSkeleton />;
  if (lines.length === 0) {
    return (
      <div>
        <EmptyLine />
        {empty}
      </div>
    );
  }
  return <FilledBag />;
}

function FilledBag(): React.JSX.Element {
  const bag = useBagBill();
  return (
    <div>
      <div className="grid items-start gap-3 min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] min-[900px]:gap-8">
        <BagLines />
        <div className="grid gap-3 min-[900px]:sticky min-[900px]:top-[calc(var(--top-h)+16px)]">
          <BagExtras bag={bag} />
          <Link href="/checkout" className={`${checkoutButton} press hidden w-full min-[900px]:inline-grid`}>
            Checkout
          </Link>
        </div>
      </div>
      <div className="bg-paper border-line sticky bottom-[max(8px,env(safe-area-inset-bottom))] z-10 mt-3 flex items-center justify-between gap-4 rounded-[20px] border py-2 pl-4 pr-2 shadow-[0_6px_24px_rgba(30,27,22,0.16)] min-[900px]:hidden">
        <TotalNow bag={bag} />
        <Link href="/checkout" className={`${checkoutButton} press h-12 px-8`}>
          Checkout
        </Link>
      </div>
    </div>
  );
}

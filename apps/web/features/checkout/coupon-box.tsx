'use client';

import { useEffect, useState } from 'react';

import {
  bestCoupon,
  couponTerms,
  couponTitle,
  formatUsd,
  nextCoupon,
  promoDiscountCents,
  type CheckoutOffers,
  type PublicCoupon,
} from '@repo/shared/domain';

const applyButton =
  'border-brand text-brand font-ui rounded-pill min-h-9 shrink-0 border px-4 text-sm font-semibold disabled:opacity-50';
const codeTag = 'border-line text-ink rounded border border-dashed px-1.5 py-0.5 text-xs font-semibold tracking-wide';

/**
 * D-191: checkout's coupons: the one that takes the most off this bag on top with Apply, "View all coupons" for a small tab
 * instead of a page, and the customer's coins (or the way to them for a guest). Every figure here is a preview; the server
 * prices the bag with the code (pricing.ts) and has the last word.
 */
export function CouponBox({
  offers,
  subtotalCents,
  bulkCents,
  applied,
  rejected,
  busy,
  onApply,
}: {
  offers: CheckoutOffers;
  subtotalCents: number;
  /** The bulk saving a coupon would replace: a coupon has to beat it. */
  bulkCents: number;
  /** The code on the bag. */
  applied: string | null;
  /** What the server said about the code just tried, if it refused it. */
  rejected: string | null;
  busy: boolean;
  onApply: (code: string | null) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const best = bestCoupon(offers, subtotalCents, bulkCents);
  const next = nextCoupon(offers, subtotalCents);
  const on = applied ? offers.coupons.find((c) => c.code === applied) : undefined;
  const apply = (code: string | null): void => {
    setOpen(false);
    onApply(code);
  };

  return (
    <section aria-label="Coupons" className="bg-surface font-ui relative mb-2 rounded-lg px-4 py-3.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-semibold">Coupons</h3>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="text-ink-muted min-h-9 text-[13px] underline underline-offset-[3px]"
        >
          View all coupons
        </button>
      </div>

      {applied ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="m-0 min-w-0">
            <span className={codeTag}>{applied}</span>{' '}
            <span className="text-positive font-semibold">
              Applied{on ? `: ${formatUsd(promoDiscountCents(subtotalCents, on))} off` : ''}
            </span>
          </p>
          <button type="button" disabled={busy} onClick={() => apply(null)} className="text-ink-muted min-h-9 shrink-0 text-[13px] underline underline-offset-[3px]">
            Remove
          </button>
        </div>
      ) : best ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <p className="m-0 min-w-0">
            <span className="block font-semibold">Save {formatUsd(promoDiscountCents(subtotalCents, best))} on this bag</span>
            <span className="text-ink-muted block text-[13px]">
              <span className={codeTag}>{best.code}</span> Best for your bag
            </span>
          </p>
          <button type="button" disabled={busy} onClick={() => apply(best.code)} className={applyButton}>
            Apply
          </button>
        </div>
      ) : next ? (
        <p className="text-ink-muted m-0 mt-1.5">
          Add {formatUsd(next.moreCents)} more for {couponTitle(next.coupon)}.
        </p>
      ) : null}
      {rejected ? (
        <p className="text-caution m-0 mt-1.5 text-[13px]" role="status">
          {rejected}
        </p>
      ) : null}

      {offers.coins !== null ? (
        <p className="border-line m-0 mt-2.5 flex items-baseline justify-between gap-3 border-t pt-2.5">
          <span>
            Your wallet: <b className="font-semibold">{offers.coins} coins</b>
          </span>
          <span className="text-ink-muted text-[13px]">1 coin = 1¢, used on this order</span>
        </p>
      ) : (
        <p className="border-line text-ink-muted m-0 mt-2.5 border-t pt-2.5 text-[13px]">
          <a href="/login?next=/checkout" className="text-ink font-medium underline underline-offset-[3px]">
            Sign in
          </a>{' '}
          to use your coins.
        </p>
      )}

      {open ? (
        <>
          {/* a tap anywhere else closes the tab */}
          <button type="button" aria-label="Close coupons" tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-20 cursor-default" />
          <div
            role="dialog"
            aria-label="All coupons"
            className="bg-paper border-line absolute right-2 top-12 z-30 max-h-[60dvh] w-[min(330px,calc(100%-16px))] overflow-y-auto rounded-lg border p-3 shadow-lg"
          >
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {offers.coupons.map((c) => (
                <CouponRow key={c.code} coupon={c} offers={offers} subtotalCents={subtotalCents} bulkCents={bulkCents} applied={applied} busy={busy} onApply={apply} />
              ))}
            </ul>
            <form
              className="border-line mt-3 flex gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) apply(typed.trim().toUpperCase());
              }}
            >
              <input
                aria-label="Coupon code"
                placeholder="Have a code?"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="border-line bg-paper min-h-9 w-full min-w-0 rounded-md border px-2.5 text-sm"
              />
              <button type="submit" disabled={busy || !typed.trim()} className={applyButton}>
                Apply
              </button>
            </form>
          </div>
        </>
      ) : null}
    </section>
  );
}

function CouponRow({
  coupon,
  offers,
  subtotalCents,
  bulkCents,
  applied,
  busy,
  onApply,
}: {
  coupon: PublicCoupon;
  offers: CheckoutOffers;
  subtotalCents: number;
  bulkCents: number;
  applied: string | null;
  busy: boolean;
  onApply: (code: string | null) => void;
}): React.JSX.Element {
  const off = promoDiscountCents(subtotalCents, coupon);
  const reached = subtotalCents >= coupon.minOrderCents;
  const firstOnly = coupon.newCustomersOnly && !offers.isNewCustomer;
  const why = firstOnly
    ? 'For a first order'
    : !reached
      ? `Add ${formatUsd(coupon.minOrderCents - subtotalCents)} more`
      : off <= bulkCents
        ? 'Your bulk saving is more'
        : null;
  return (
    <li className="flex items-center justify-between gap-3">
      <p className="m-0 min-w-0">
        <span className="block font-semibold">{couponTitle(coupon)}</span>
        <span className="text-ink-muted block text-[13px]">
          <span className={codeTag}>{coupon.code}</span> {couponTerms(coupon)}
        </span>
      </p>
      {applied === coupon.code ? (
        <span className="text-positive shrink-0 text-[13px] font-semibold">Applied</span>
      ) : why ? (
        <span className="text-ink-muted shrink-0 text-right text-[13px]">{why}</span>
      ) : (
        <button type="button" disabled={busy} onClick={() => onApply(coupon.code)} className={applyButton}>
          Apply
        </button>
      )}
    </li>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

import { bestCoupon, couponStanding, couponTerms, couponTitle, formatUsd, nextCoupon, promoDiscountCents, sortedCoupons, type PublicCoupon } from '@repo/shared/domain';

import { BackToShopping } from './back-to-shopping';
import { tryCode } from './offers';
import { useCart } from './store';

import type { BagBill } from './use-bag-bill';

const apply = 'bg-brand text-on-brand font-ui rounded-pill press min-h-10 shrink-0 px-5 text-sm font-semibold disabled:opacity-50';
const quiet = 'text-ink-muted min-h-10 shrink-0 text-[13px] font-medium underline underline-offset-[3px]';
const usableBox = 'bg-positive-soft border-positive/35 rounded-[14px] border px-3 py-2.5';
const greyBox = 'bg-ink/5 text-ink-muted rounded-[14px] px-3 py-2.5';

const Code = ({ code }: { code: string }): React.JSX.Element => (
  <span className="border-ink/25 rounded border border-dashed px-1.5 py-px text-[11.5px] font-semibold tracking-wide">{code}</span>
);

/**
 * D-192: the coupons, in the bag only. The best one for this bag in colour with Apply, what the next one takes beside Back
 * to shopping, and all of them in a sheet that rises from the bottom of the phone: usable in colour with Apply, the rest
 * greyed with the reason. Applying needs no request: the bill below moves at once and the server checks it at checkout.
 */
export function CouponCard({ bag, freeGap, onShop }: { bag: BagBill; freeGap: boolean; onShop?: () => void }): React.JSX.Element | null {
  const setPicked = useCart((s) => s.setPromoCode);
  const [open, setOpen] = useState(false);
  const { offers, failed, retry, picked, coupon, subtotalCents, bulkCents } = bag;

  if (!offers) {
    return failed ? (
      <p className="bg-paper border-line font-ui m-0 flex items-center justify-between gap-3 rounded-lg border px-4 py-2 text-sm">
        <span className="text-ink-muted">Coupons didn&apos;t load.</span>
        <button type="button" onClick={retry} className={quiet}>
          Try again
        </button>
      </p>
    ) : null;
  }
  if (offers.coupons.length === 0) return null;

  const best = bestCoupon(offers, subtotalCents, bulkCents);
  const nowCents = coupon ? promoDiscountCents(subtotalCents, coupon) : bulkCents;
  const next = nextCoupon(offers, subtotalCents, nowCents);
  // a picked coupon this bag doesn't reach right now stays picked: it counts again when the bag grows
  const waiting = picked && !coupon ? offers.coupons.find((c) => c.code === picked) : undefined;
  const standing = waiting ? couponStanding(waiting, offers, subtotalCents, bulkCents) : null;
  const showBest = !coupon && !waiting && best;
  // one "add more" at a time: free delivery comes first, unless this card would have nothing else to say
  const showNext = next && !waiting && (!freeGap || (!coupon && !best));

  return (
    <section aria-label="Coupons" className="bg-paper border-line font-ui grid gap-2.5 rounded-lg border p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[15px] font-semibold">Coupons</h2>
        <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className={quiet}>
          View all coupons
        </button>
      </div>

      {coupon ? (
        <div className={`${usableBox} flex items-center justify-between gap-3`}>
          <p className="m-0 min-w-0">
            <span className="text-positive block font-semibold">✓ Applied: {formatUsd(promoDiscountCents(subtotalCents, coupon))} off</span>
            <Code code={coupon.code} />
          </p>
          <button type="button" onClick={() => setPicked(null)} className={quiet}>
            Remove
          </button>
        </div>
      ) : null}

      {waiting ? (
        <div className={`${greyBox} grid gap-2`}>
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 min-w-0">
              <span className="block font-semibold">{couponTitle(waiting)}</span>
              <Code code={waiting.code} />
            </p>
            <button type="button" onClick={() => setPicked(null)} className={quiet}>
              Remove
            </button>
          </div>
          {standing?.kind === 'short' ? (
            <div className="flex items-center justify-between gap-3">
              <span>Add {formatUsd(standing.moreCents)} more to use it</span>
              <BackToShopping onShop={onShop} />
            </div>
          ) : (
            <span>{standing?.kind === 'first-order' ? 'For a first order' : 'Your bulk saving is bigger, so it stays on'}</span>
          )}
        </div>
      ) : null}

      {showBest ? (
        <div className={`${usableBox} flex items-center justify-between gap-3`}>
          <p className="m-0 min-w-0">
            <span className="block font-semibold">Save {formatUsd(promoDiscountCents(subtotalCents, showBest))}</span>
            <span className="text-ink-muted flex flex-wrap items-center gap-x-1.5 text-[13px]">
              <Code code={showBest.code} /> Best for your bag
            </span>
          </p>
          <button type="button" onClick={() => setPicked(showBest.code)} className={apply}>
            Apply
          </button>
        </div>
      ) : null}

      {showNext ? (
        <div className="flex items-center justify-between gap-3">
          <span>
            Add <b className="font-semibold">{formatUsd(next.moreCents)}</b> more for {couponTitle(next.coupon)}
          </span>
          <BackToShopping onShop={onShop} />
        </div>
      ) : null}

      {open ? (
        <CouponSheet
          bag={bag}
          onClose={() => setOpen(false)}
          onPick={(code) => {
            setPicked(code);
            setOpen(false);
          }}
          onShop={
            onShop
              ? () => {
                  setOpen(false);
                  onShop();
                }
              : undefined
          }
        />
      ) : null}
    </section>
  );
}

/** A native modal dialog: it keeps the focus inside, closes on Escape and hands the focus back. */
function CouponSheet({
  bag,
  onClose,
  onPick,
  onShop,
}: {
  bag: BagBill;
  onClose: () => void;
  onPick: (code: string | null) => void;
  onShop?: () => void;
}): React.JSX.Element {
  const box = useRef<HTMLDialogElement>(null);
  const { offers, picked, coupon, subtotalCents, bulkCents } = bag;
  const [typed, setTyped] = useState('');
  const [checking, setChecking] = useState(false);
  const [refused, setRefused] = useState(false);
  useEffect(() => {
    const d = box.current;
    if (d && !d.open) d.showModal();
  }, []);
  const list = offers ? sortedCoupons(offers, subtotalCents, bulkCents) : [];
  const bestCode = list[0]?.standing.kind === 'usable' ? list[0].coupon.code : null;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const code = typed.trim().toUpperCase();
    if (!code || checking) return;
    setChecking(true);
    setRefused(false);
    const ok = await tryCode(code);
    setChecking(false);
    if (ok) onPick(code);
    else setRefused(true);
  }

  return (
    <dialog
      ref={box}
      aria-label="All coupons"
      onClose={onClose}
      // the panel behind listens for Escape too: this one closes only the sheet
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      onClick={(e) => {
        if (e.target === box.current) box.current?.close();
      }}
      className="bg-paper text-ink font-ui fixed inset-x-0 bottom-0 top-auto m-0 max-h-[80dvh] w-full max-w-none overflow-hidden rounded-t-[22px] p-0 backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[440px] sm:rounded-[22px]"
    >
      <div className="flex max-h-[80dvh] flex-col">
        <header className="border-line flex items-center justify-between gap-3 border-b py-1.5 pl-4 pr-1.5">
          <h2 className="m-0 text-base font-semibold">All coupons</h2>
          <button type="button" aria-label="Close coupons" onClick={() => box.current?.close()} className="grid size-11 place-items-center text-xl leading-none">
            ×
          </button>
        </header>
        <ul className="m-0 grid list-none gap-2.5 overflow-y-auto overscroll-contain p-3 text-sm">
          {list.map(({ coupon: c, standing }) => (
            <CouponRow
              key={c.code}
              coupon={c}
              standing={standing}
              best={c.code === bestCode}
              applied={coupon?.code === c.code}
              picked={picked === c.code}
              onPick={onPick}
              onShop={onShop}
            />
          ))}
        </ul>
        <form onSubmit={(e) => void submit(e)} className="border-line grid gap-1.5 border-t p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <input
              aria-label="Coupon code"
              placeholder="Have a code?"
              autoCapitalize="characters"
              autoCorrect="off"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setRefused(false);
              }}
              className="border-line bg-paper min-h-10 w-full min-w-0 rounded-md border px-3 text-[16px]"
            />
            <button type="submit" disabled={checking || !typed.trim()} className="border-brand text-brand rounded-pill min-h-10 shrink-0 border px-5 text-sm font-semibold disabled:opacity-50">
              {checking ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {refused ? (
            <p role="status" className="text-danger m-0 text-[13px]">
              That code can&apos;t be used on this bag.
            </p>
          ) : null}
        </form>
      </div>
    </dialog>
  );
}

function CouponRow({
  coupon,
  standing,
  best,
  applied,
  picked,
  onPick,
  onShop,
}: {
  coupon: PublicCoupon;
  standing: ReturnType<typeof sortedCoupons>[number]['standing'];
  best: boolean;
  applied: boolean;
  picked: boolean;
  onPick: (code: string | null) => void;
  onShop?: () => void;
}): React.JSX.Element {
  const usable = standing.kind === 'usable';
  const head = (
    <p className="m-0 min-w-0">
      <span className="flex flex-wrap items-center gap-x-2 font-semibold">
        {couponTitle(coupon)}
        {best && !applied ? <span className="bg-positive text-paper rounded px-1.5 text-[11px] font-semibold leading-[18px]">Best</span> : null}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px]">
        <Code code={coupon.code} /> <span className={usable ? 'text-ink-muted' : ''}>{couponTerms(coupon)}</span>
      </span>
    </p>
  );
  if (usable) {
    return (
      <li className={`${usableBox} flex items-center justify-between gap-3`}>
        {head}
        {applied ? (
          <span className="grid shrink-0 justify-items-end">
            <span className="text-positive font-semibold">✓ Applied</span>
            <button type="button" onClick={() => onPick(null)} className="text-ink-muted text-[13px] font-medium underline underline-offset-[3px]">
              Remove
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => onPick(coupon.code)} className={apply}>
            Apply
          </button>
        )}
      </li>
    );
  }
  return (
    <li className={`${greyBox} grid gap-2`} data-locked="">
      {head}
      {standing.kind === 'short' ? (
        <div className="flex items-center justify-between gap-3">
          <span>Add {formatUsd(standing.moreCents)} more</span>
          <BackToShopping onShop={onShop} />
        </div>
      ) : (
        <span className="text-[13px]">{standing.kind === 'first-order' ? 'For a first order' : 'Your bulk saving is bigger'}</span>
      )}
      {picked ? (
        <button type="button" onClick={() => onPick(null)} className="justify-self-start text-[13px] font-medium underline underline-offset-[3px]">
          Remove
        </button>
      ) : null}
    </li>
  );
}

'use client';

import { useState, useTransition } from 'react';

import { formatInr } from '@repo/shared/domain';

import { markOrderedAction, unmarkOrderedAction } from './actions/shop-orders';
import { button, input, secondaryButton } from './styles';

/**
 * One sold piece on its order's page (D-140, F3): **Order it ↗** opens the shop item in use (the variant's source,
 * D-118; the page first imported only when it has none), with what it costs there now; **Mark ordered** takes what was
 * paid, the shop's order number and a photo of the bill. The piece reads Ordered at once and goes back with a line if
 * the server refuses (rule 0.1); Undo while it is not at the hub.
 */
export function PieceOrdering({
  pickupId,
  orderId,
  itemUrl,
  site,
  quantity,
  soldPaise,
  nowPaise,
  inStock,
  deliveryDays,
  ordered,
}: {
  pickupId: string;
  orderId: string;
  itemUrl: string | null;
  site: string | null;
  quantity: number;
  soldPaise: number | null;
  nowPaise: number | null;
  inStock: boolean | null;
  deliveryDays: number | null;
  ordered: { paidPaise: number | null; ref: string | null } | null;
}): React.JSX.Element {
  const [done, setDone] = useState(ordered);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const shown = nowPaise ?? soldPaise;

  const submit = (form: HTMLFormElement): void => {
    const data = new FormData(form);
    const typed = String(data.get('paid') ?? '').replace(/[,\s₹]/g, '');
    const paid = typed === '' ? (shown === null ? null : shown * quantity) : Math.round(Number(typed) * 100);
    if (paid !== null && !Number.isFinite(paid)) return setError('The amount paid is not a number.');
    const send = new FormData();
    send.set('lines', JSON.stringify([{ pickup: pickupId, paid_paise: paid }]));
    send.set('orders', JSON.stringify([orderId]));
    send.set('ref', String(data.get('ref') ?? ''));
    const bill = data.get('bill');
    if (bill instanceof File && bill.size > 0) send.set('bill', bill);
    const before = done;
    setDone({ paidPaise: paid, ref: String(data.get('ref') ?? '') || null });
    setOpen(false);
    setError(null);
    start(async () => {
      const result = await markOrderedAction(send);
      if (!result.ok) {
        setDone(before);
        setError(result.error);
      }
    });
  };

  const undo = (): void => {
    const before = done;
    setDone(null);
    start(async () => {
      const result = await unmarkOrderedAction(pickupId, orderId);
      if (!result.ok) {
        setDone(before);
        setError(result.error);
      }
    });
  };

  return (
    <span className="mt-1.5 block text-[13px]">
      {done ? (
        <span className="rise-in block">
          Ordered{done.paidPaise !== null ? ` · ${formatInr(done.paidPaise)} paid` : ''}
          {done.ref ? ` · ${done.ref}` : ''} ·{' '}
          <button type="button" onClick={undo} className="min-h-11 underline md:min-h-0">
            Undo
          </button>
        </span>
      ) : (
        <>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {itemUrl ? (
              <a href={itemUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                Order it{site ? ` on ${site}` : ''} ↗
              </a>
            ) : (
              <span className="text-ink-muted">No shop page</span>
            )}
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-h-11 underline md:min-h-0">
              Mark ordered…
            </button>
          </span>
          <small className="text-ink-muted block">
            {formatInr(soldPaise)} at sale
            {nowPaise !== null && nowPaise !== soldPaise ? ` · ${formatInr(nowPaise)} now` : ''}
            {inStock === false ? ' · sold out at the last check' : ''}
            {deliveryDays !== null ? ` · at the hub in ${deliveryDays} day${deliveryDays === 1 ? '' : 's'}` : ''}
          </small>
          {open ? (
            <form
              className="border-line bg-canvas mt-2 grid gap-2 rounded-[10px] border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(e.currentTarget);
              }}
            >
              <label className="block space-y-1">
                <span className="text-ink-muted block text-[12px] font-semibold">Paid ₹ (empty: {formatInr(shown === null ? null : shown * quantity)})</span>
                <input name="paid" inputMode="decimal" className={input} />
              </label>
              <label className="block space-y-1">
                <span className="text-ink-muted block text-[12px] font-semibold">Shop order number</span>
                <input name="ref" maxLength={120} className={input} />
              </label>
              <label className="block space-y-1">
                <span className="text-ink-muted block text-[12px] font-semibold">Bill (photo or PDF, optional)</span>
                <input name="bill" type="file" accept="image/*,application/pdf" className="text-[13px]" />
              </label>
              <span className="flex gap-2">
                <button type="submit" className={button}>
                  Mark ordered
                </button>
                <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                  Cancel
                </button>
              </span>
            </form>
          ) : null}
        </>
      )}
      {error ? (
        <span className="text-danger block" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

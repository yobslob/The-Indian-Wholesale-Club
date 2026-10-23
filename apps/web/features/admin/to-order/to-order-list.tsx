'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

import { formatInr } from '@repo/shared/domain';

import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import { markOrderedAction, unmarkOrderedAction } from '../actions/shop-orders';
import { button, input, panel, secondaryButton } from '../styles';

import { dueIn, waited, type ShopGroup } from './group';

/**
 * The India desk's To order list (D-140, F3): one card per shop, its pieces oldest first. **Order all from this
 * shop** puts every piece in the shop's cart where it can (Amazon, Shopify shops) or opens each piece; **Mark all
 * ordered** takes one shop order number and one bill for the lot. The card leaves the list at once and comes back
 * with a line if the server refuses (rule 0.1); Undo puts the pieces back.
 */
export function ToOrderList({ groups }: { groups: ShopGroup[] }): React.JSX.Element {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <ShopCard key={g.key} group={g} />
      ))}
    </div>
  );
}

function ShopCard({ group }: { group: ShopGroup }): React.JSX.Element | null {
  const [state, setState] = useState<'open' | 'ordered'>('open');
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const pieces = group.rows.reduce((n, r) => n + r.quantity, 0);

  const openEach = (): void => {
    for (const r of group.rows) if (r.item_url) window.open(r.item_url, '_blank', 'noopener');
  };

  const submit = (form: HTMLFormElement): void => {
    const data = new FormData(form);
    const lines = group.rows.map((r) => {
      const typed = String(data.get(`paid-${r.pickup_id}`) ?? '').replace(/[,\s₹]/g, '');
      // empty: the price shown (the shop's price now, else at sale) × quantity
      const shown = r.now_paise ?? r.sold_paise;
      return {
        pickup: r.pickup_id,
        paid_paise: typed === '' ? (shown === null ? null : shown * r.quantity) : Math.round(Number(typed) * 100),
      };
    });
    if (lines.some((l) => l.paid_paise !== null && !Number.isFinite(l.paid_paise))) {
      setError('An amount paid is not a number.');
      return;
    }
    const send = new FormData();
    send.set('lines', JSON.stringify(lines));
    send.set('orders', JSON.stringify([...new Set(group.rows.map((r) => r.order_id))]));
    send.set('ref', String(data.get('ref') ?? ''));
    const bill = data.get('bill');
    if (bill instanceof File && bill.size > 0) send.set('bill', bill);
    setError(null);
    setState('ordered');
    start(async () => {
      const result = await markOrderedAction(send);
      if (!result.ok) {
        setState('open');
        setError(result.error);
      }
    });
  };

  const undo = (): void => {
    setState('open');
    start(async () => {
      for (const r of group.rows) {
        const result = await unmarkOrderedAction(r.pickup_id, r.order_id);
        if (!result.ok) {
          setState('ordered');
          setError(result.error);
          return;
        }
      }
    });
  };

  if (state === 'ordered')
    return (
      <p className={`${panel} rise-in flex flex-wrap items-center gap-3 text-[14px]`} role="status">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="text-positive h-5 w-5 fill-none stroke-current stroke-2">
          <path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {group.label}: {pieces} piece{pieces === 1 ? '' : 's'} marked ordered.
        <button type="button" onClick={undo} className="min-h-11 underline">
          Undo
        </button>
        {error ? <span className="text-danger">{error}</span> : null}
      </p>
    );

  return (
    <section className={panel} aria-label={group.label}>
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-heading text-[17px] font-semibold">{group.label}</h2>
        <span className="text-ink-muted text-[13px]">
          {pieces} piece{pieces === 1 ? '' : 's'} · oldest waiting {waited(group.oldest)} · {formatInr(group.soldPaise)} at sale
          {group.nowPaise !== group.soldPaise ? `, ${formatInr(group.nowPaise)} now` : ''}
        </span>
        <span className="ml-auto">
          {group.cartUrl ? (
            <a href={group.cartUrl} target="_blank" rel="noreferrer" className={secondaryButton}>
              Order all from this shop ↗
            </a>
          ) : group.rows.filter((r) => r.item_url).length > 1 ? (
            <button type="button" onClick={openEach} className={secondaryButton} title="Opens each piece in its own tab (allow pop-ups for this site)">
              Open each piece ↗
            </button>
          ) : null}
        </span>
      </header>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <ul className="divide-line border-line divide-y border-y">
          {group.rows.map((r) => (
            <PieceRow key={r.pickup_id} row={r} />
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block space-y-1">
            <span className="text-ink-muted block text-[12px] font-semibold">Shop order number</span>
            <input name="ref" maxLength={120} placeholder="e.g. 402-1234567-1234567" className={`${input} md:w-64`} />
          </label>
          <label className="block space-y-1">
            <span className="text-ink-muted block text-[12px] font-semibold">Bill (photo or PDF, optional)</span>
            <input name="bill" type="file" accept="image/*,application/pdf" className="text-[13px]" />
          </label>
          <button type="submit" className={`${button} md:ml-auto`}>
            {group.rows.length === 1 ? 'Mark ordered' : `Mark all ${group.rows.length} ordered`}
          </button>
        </div>
        {error ? (
          <p className="text-danger mt-2 text-[13px]" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function PieceRow({ row: r }: { row: ShopGroup['rows'][number] }): React.JSX.Element {
  const now = r.now_paise ?? r.sold_paise;
  const dearer = r.now_paise !== null && r.sold_paise !== null && r.now_paise > r.sold_paise;
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-2.5 text-[14px] md:grid-cols-[40px_minmax(0,1fr)_auto_140px]">
      <span className="bg-land relative block h-[54px] w-10 overflow-hidden rounded-lg">
        {r.image_path ? <StorePhoto src={mediaUrl(r.image_path)} alt="" sizes="40px" className="object-cover" /> : null}
      </span>
      <span className="min-w-0">
        <b className="block font-semibold">{r.product_name}</b>
        <small className="text-ink-muted block text-[12.5px]">
          {r.variant_label} × {r.quantity} ·{' '}
          <Link href={`/admin/orders/${r.order_id}`} className="underline">
            {r.order_number}
          </Link>{' '}
          · waiting {waited(r.ordered_on)}
          {r.delivery_days !== null ? ` · at the hub in ${r.delivery_days} day${r.delivery_days === 1 ? '' : 's'}` : ''}
        </small>
        {r.buy_by && r.ship_by ? <QuickDue buyBy={r.buy_by} shipBy={r.ship_by} /> : null}
        {r.in_stock === false ? <small className="text-danger block text-[12.5px] font-semibold">Sold out at the shop at the last check</small> : null}
      </span>
      <span className="col-start-2 text-[13px] md:col-start-auto md:text-right">
        {r.item_url ? (
          <a href={r.item_url} target="_blank" rel="noreferrer" className="font-semibold underline">
            Order it ↗
          </a>
        ) : (
          <span className="text-ink-muted">No shop page</span>
        )}
        <small className={`block ${dearer ? 'text-caution font-semibold' : 'text-ink-muted'}`}>
          {formatInr(r.sold_paise)} at sale{r.now_paise !== null && r.now_paise !== r.sold_paise ? ` · ${formatInr(r.now_paise)} now` : ''}
        </small>
      </span>
      <label className="col-start-2 block md:col-start-auto">
        <span className="sr-only">Paid for {r.product_name}, ₹</span>
        <input
          name={`paid-${r.pickup_id}`}
          inputMode="decimal"
          placeholder={now !== null ? String((now * r.quantity) / 100) : 'Paid ₹'}
          aria-describedby={`paid-help-${r.pickup_id}`}
          className={input}
        />
        <small id={`paid-help-${r.pickup_id}`} className="text-ink-muted block text-[11.5px]">
          Paid ₹ (empty: the price shown)
        </small>
      </label>
    </li>
  );
}

/** D-154: a 7-day piece is bought within 2 hours of the order and leaves the hub the next day. */
function QuickDue({ buyBy, shipBy }: { buyBy: string; shipBy: string }): React.JSX.Element {
  const buy = dueIn(buyBy);
  const ship = dueIn(shipBy);
  return (
    <small className={`block text-[12.5px] font-semibold ${buy.late ? 'text-danger' : 'text-brand'}`}>
      7-day · buy {buy.text} · ship {ship.text}
    </small>
  );
}

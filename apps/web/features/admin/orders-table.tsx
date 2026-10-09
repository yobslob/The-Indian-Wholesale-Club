'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { CARRIERS } from '@repo/shared/domain';

import { bulkDeliveredAction, bulkShipAction, type BulkResult } from './actions/orders';
import { Chip, ORDER_STATUS, PAYMENT_STATUS } from './chips';
import { Modal } from './modal';
import { button, input, secondaryButton } from './styles';

import type { Enum } from '@repo/db';

export interface OrderRow {
  id: string;
  number: string;
  name: string;
  email: string;
  placed: { main: string; other: string };
  status: Enum<'order_status'>;
  payment: Enum<'payment_status'>;
  pieces: number;
  total: string;
  window: string;
  /** Arrived in the US, or an express order still in India (D-070): it can be marked shipped. */
  canShip: boolean;
}

const th = 'border-line text-ink-muted whitespace-nowrap border-b px-2.5 pb-2 text-[11.5px] font-semibold uppercase tracking-[0.06em]';
const td = 'border-line border-b p-2.5 align-middle';

function Box({ on, label, onChange }: { on: boolean | 'some'; label: string; onChange: () => void }): React.JSX.Element {
  return (
    <label className="grid h-11 w-8 cursor-pointer place-items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={on === true}
        ref={(el) => {
          if (el) el.indeterminate = on === 'some';
        }}
        onChange={onChange}
        className="accent-ink h-[18px] w-[18px]"
      />
    </label>
  );
}

/**
 * Orders as a table (D-096): tick rows and a bar appears at the bottom with Mark shipped… (one carrier and tracking
 * number per order) and Mark delivered. The database still decides what may happen to each order.
 */
export function OrdersTable({ rows }: { rows: OrderRow[] }): React.JSX.Element {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<'ship' | 'deliver' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const chosen = rows.filter((r) => picked.has(r.id));
  const toShip = chosen.filter((r) => r.canShip);
  const toDeliver = chosen.filter((r) => r.status === 'shipped');
  const all = rows.length > 0 && picked.size === rows.length ? true : picked.size > 0 ? 'some' : false;

  const toggle = (id: string): void =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const report = (verb: string, r: BulkResult): void => {
    const names = new Map(rows.map((row) => [row.id, row.number]));
    setResult(
      `${r.done} ${verb}.` + (r.failed.length ? ` Not changed: ${r.failed.map((f) => `${names.get(f.id) ?? f.id} (${f.error})`).join('; ')}` : ''),
    );
    setPicked(new Set());
    setDialog(null);
    router.refresh();
  };
  const ship = (form: FormData): void =>
    start(async () => {
      const lines = toShip.map((r) => {
        const carrier = String(form.get(`carrier-${r.id}`) ?? '');
        const other = String(form.get(`other-${r.id}`) ?? '').trim();
        return { orderId: r.id, carrier: carrier === 'Other' ? other : carrier, tracking: String(form.get(`tracking-${r.id}`) ?? '') };
      });
      report('marked shipped', await bulkShipAction(lines));
    });
  const deliver = (): void => start(async () => report('marked delivered', await bulkDeliveredAction(toDeliver.map((r) => r.id))));

  return (
    <>
      {result ? (
        <p role="status" className="border-line bg-paper mb-3 rounded-[10px] border px-3 py-2 text-[14px]">
          {result}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="font-ui w-full border-collapse text-left text-[14px] leading-[1.3]">
          <thead>
            <tr>
              <th className={`${th} w-8`}>
                <Box on={all} label="Tick every order on this page" onChange={() => setPicked(all === true ? new Set() : new Set(rows.map((r) => r.id)))} />
              </th>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>Placed</th>
              <th className={th}>Status</th>
              <th className={th}>Payment</th>
              <th className={`${th} text-right`}>Pieces</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Window</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = picked.has(r.id);
              return (
                <tr key={r.id} className={on ? '[&>td]:bg-brand/5' : 'hover:[&>td]:bg-paper/60'}>
                  <td className={td}>
                    <Box on={on} label={`Tick ${r.number}`} onChange={() => toggle(r.id)} />
                  </td>
                  <td className={td}>
                    <Link href={`/admin/orders/${r.id}`} className="whitespace-nowrap font-semibold">
                      {r.number}
                    </Link>
                  </td>
                  <td className={td}>
                    {r.name || '—'}
                    <small className="text-ink-muted mt-0.5 block text-[12px]">{r.email}</small>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {r.placed.main}
                    <small className="text-ink-muted mt-0.5 block text-[12px]">{r.placed.other}</small>
                  </td>
                  <td className={td}>
                    <Chip tone={ORDER_STATUS[r.status][1]}>{ORDER_STATUS[r.status][0]}</Chip>
                  </td>
                  <td className={td}>
                    <Chip tone={PAYMENT_STATUS[r.payment][1]}>{PAYMENT_STATUS[r.payment][0]}</Chip>
                  </td>
                  <td className={`${td} text-right`}>{r.pieces}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>{r.total}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.window}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {picked.size > 0 ? (
        <div className="bg-ink text-paper sticky bottom-3 z-20 mt-3 flex flex-wrap items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-semibold">
          {picked.size} selected
          <button type="button" disabled={toShip.length === 0} onClick={() => setDialog('ship')} className={`${secondaryButton} md:h-[34px]`}>
            Mark shipped…{toShip.length && toShip.length !== picked.size ? ` (${toShip.length})` : ''}
          </button>
          <button type="button" disabled={toDeliver.length === 0} onClick={() => setDialog('deliver')} className={`${secondaryButton} md:h-[34px]`}>
            Mark delivered{toDeliver.length && toDeliver.length !== picked.size ? ` (${toDeliver.length})` : ''}
          </button>
          <span className="hidden text-[13px] font-normal opacity-80 lg:inline">Mark shipped asks one tracking number per order</span>
          <button type="button" onClick={() => setPicked(new Set())} className="text-paper ml-auto min-h-11 px-2 underline md:min-h-0">
            Clear
          </button>
        </div>
      ) : null}

      {dialog === 'ship' ? (
        <Modal title={`Mark ${toShip.length} shipped`} onClose={() => setDialog(null)} wide>
          <form action={ship} className="space-y-3">
            <p className="text-[14px] leading-[1.5]">Each customer is emailed a link to their order page with the tracking number.</p>
            {toShip.map((r) => (
              <fieldset key={r.id} className="border-line grid gap-2 border-t pt-3 sm:grid-cols-[1fr_120px_1fr]">
                <legend className="mb-1 text-[13px] font-semibold">
                  {r.number} <span className="text-ink-muted font-normal">· {r.name || r.email}</span>
                </legend>
                <select name={`carrier-${r.id}`} aria-label={`Carrier for ${r.number}`} className={input} defaultValue={CARRIERS[0]}>
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="Other">Other</option>
                </select>
                <input name={`other-${r.id}`} aria-label={`Other carrier for ${r.number}`} placeholder="Other carrier" className={input} />
                <input name={`tracking-${r.id}`} aria-label={`Tracking number for ${r.number}`} required minLength={4} placeholder="Tracking number" className={input} />
              </fieldset>
            ))}
            {chosen.length > toShip.length ? (
              <p className="text-ink-muted text-[13px]">{chosen.length - toShip.length} ticked order(s) can't ship yet and are left as they are.</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDialog(null)} className={secondaryButton}>
                Keep them
              </button>
              <button type="submit" disabled={pending} className={button}>
                {pending ? 'Marking…' : `Mark ${toShip.length} shipped`}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {dialog === 'deliver' ? (
        <Modal title={`Mark ${toDeliver.length} delivered?`} onClose={() => setDialog(null)}>
          <p className="mb-3 text-[14px] leading-[1.5]">
            {toDeliver.map((r) => r.number).join(', ')}. Each customer is emailed that it arrived.
            {chosen.length > toDeliver.length ? ` ${chosen.length - toDeliver.length} ticked order(s) aren't shipped and are left as they are.` : ''}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDialog(null)} className={secondaryButton}>
              Keep them
            </button>
            <button type="button" data-autofocus disabled={pending} onClick={deliver} className={button}>
              {pending ? 'Marking…' : `Mark ${toDeliver.length} delivered`}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

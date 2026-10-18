'use client';

import { useRef, useState, useTransition } from 'react';

import { formatInr, shopBillTotalPaise } from '@repo/shared/domain';

import { removeShopBillPhotoAction, saveShopBillAction, setShopBillFinalAction, uploadShopBillPhotosAction } from '../actions/shop-orders';
import { button, input, secondaryButton } from '../styles';

import { BillPhotos, type BillPhoto } from './bill-photos';

export interface BillRow {
  key: string;
  kind: 'piece' | 'delivery' | 'extra';
  order_item_id: string | null;
  label: string;
  quantity: number;
  /** One piece's price paid, in rupees as typed (a coupon is a minus). */
  unit: string;
  shop: string;
  shop_order_ref: string;
}

/** A dense cell field: 44 px tall on phones, 36 px in the desktop table. */
const cell = 'h-11 w-full rounded-[7px] border border-line bg-canvas px-2 text-[13.5px] text-ink disabled:opacity-60 md:h-9';

const toPaise = (rupees: string): number => Math.round(Number(rupees.replace(/[,\s₹]/g, '') || '0') * 100);

/**
 * Invoice C, the shop bill (D-140, plan F4): what the shops' carts cost for this order, as the India desk fills it in.
 * A row per piece at the shop's price when it sold (Mark ordered fills in what was paid), a Delivery row, and extra rows
 * (a packing fee, a coupon as a minus); the total adds up as it is typed. Save keeps a draft; Mark final locks it (an
 * admin can reopen it, logged). Photos of the bill: drop them, pick them, take one with the camera, or paste a
 * screenshot anywhere on the form (Ctrl+V). They go to the private vendor-docs bucket, never public.
 */
export function ShopBillForm({
  orderId,
  initialRows,
  initialNote,
  final,
  photos,
}: {
  orderId: string;
  initialRows: BillRow[];
  initialNote: string;
  final: boolean;
  photos: BillPhoto[];
}): React.JSX.Element {
  const [rows, setRows] = useState(initialRows);
  const [note, setNote] = useState(initialNote);
  const [locked, setLocked] = useState(final);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const total = shopBillTotalPaise(rows.map((r) => ({ unit_paise: toPaise(r.unit), quantity: r.quantity })));

  const edit = (key: string, patch: Partial<BillRow>): void => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
    setMessage(null);
  };

  const save = (then?: () => Promise<{ ok: boolean; error?: string }>): void => {
    const lines = rows.map((r) => ({
      kind: r.kind,
      order_item_id: r.order_item_id,
      label: r.label.trim() || (r.kind === 'delivery' ? 'Delivery' : 'Extra'),
      quantity: r.quantity,
      unit_paise: toPaise(r.unit),
      shop: r.shop.trim() || null,
      shop_order_ref: r.shop_order_ref.trim() || null,
    }));
    if (lines.some((l) => !Number.isFinite(l.unit_paise))) {
      setMessage({ ok: false, text: 'A price is not a number.' });
      return;
    }
    setMessage({ ok: true, text: 'Saving…' });
    start(async () => {
      const saved = await saveShopBillAction(orderId, lines, note);
      if (!saved.ok) return setMessage({ ok: false, text: saved.error });
      setDirty(false);
      if (then) {
        const next = await then();
        if (!next.ok) return setMessage({ ok: false, text: next.error ?? 'That did not save.' });
      }
      setMessage({ ok: true, text: then ? 'Marked final.' : 'Saved.' });
    });
  };

  const upload = (files: File[]): void => {
    if (locked || files.length === 0) return;
    const data = new FormData();
    for (const f of files.slice(0, 10)) data.append('photos', f);
    setMessage({ ok: true, text: `Adding ${files.length} photo${files.length === 1 ? '' : 's'}…` });
    start(async () => {
      const result = await uploadShopBillPhotosAction(orderId, data);
      setMessage(result.ok ? { ok: true, text: 'Photo added.' } : { ok: false, text: result.error });
    });
  };

  return (
    <form
      ref={formRef}
      aria-busy={pending}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onPaste={(e) => {
        const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/') || f.type === 'application/pdf');
        if (files.length) {
          e.preventDefault();
          upload(files);
        }
      }}
      className="space-y-3"
    >
      <div className="overflow-x-auto">
        <table className="font-ui w-full min-w-[620px] border-collapse text-left text-[13.5px]">
          <thead>
            <tr className="text-ink-muted text-[11.5px] uppercase tracking-[0.06em]">
              <th className="border-line border-b px-1.5 pb-1.5 font-semibold">Row</th>
              <th className="border-line w-14 border-b px-1.5 pb-1.5 text-right font-semibold">Qty</th>
              <th className="border-line w-28 border-b px-1.5 pb-1.5 text-right font-semibold">Each ₹</th>
              <th className="border-line w-28 border-b px-1.5 pb-1.5 font-semibold">Shop</th>
              <th className="border-line w-36 border-b px-1.5 pb-1.5 font-semibold">Shop order no.</th>
              <th className="border-line w-24 border-b px-1.5 pb-1.5 text-right font-semibold">Total</th>
              <th className="border-line w-8 border-b" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-line border-b align-middle">
                <td className="px-1.5 py-1">
                  {r.kind === 'piece' ? (
                    <span>{r.label}</span>
                  ) : (
                    <input aria-label="Row" value={r.label} disabled={locked} onChange={(e) => edit(r.key, { label: e.target.value })} className={cell} />
                  )}
                </td>
                <td className="px-1.5 py-1 text-right">
                  {r.kind === 'piece' ? (
                    r.quantity
                  ) : (
                    <input aria-label="Quantity" type="number" min={1} max={999} value={r.quantity} disabled={locked} onChange={(e) => edit(r.key, { quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} className={`${cell} text-right`} />
                  )}
                </td>
                <td className="px-1.5 py-1">
                  <input aria-label={`Each, ₹: ${r.label}`} inputMode="decimal" value={r.unit} disabled={locked} onChange={(e) => edit(r.key, { unit: e.target.value })} className={`${cell} text-right`} />
                </td>
                <td className="px-1.5 py-1">
                  <input aria-label="Shop" value={r.shop} disabled={locked} onChange={(e) => edit(r.key, { shop: e.target.value })} className={cell} />
                </td>
                <td className="px-1.5 py-1">
                  <input aria-label="Shop order number" value={r.shop_order_ref} disabled={locked} onChange={(e) => edit(r.key, { shop_order_ref: e.target.value })} className={cell} />
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-right font-semibold">{formatInr(toPaise(r.unit) * r.quantity)}</td>
                <td className="px-1 py-1 text-center">
                  {r.kind === 'extra' && !locked ? (
                    <button type="button" aria-label={`Remove ${r.label || 'row'}`} onClick={() => (setRows((rs) => rs.filter((x) => x.key !== r.key)), setDirty(true))} className="text-ink-muted hover:text-danger grid h-9 w-8 place-items-center text-[18px]">
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-1.5 pt-2" colSpan={5}>
                {!locked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRows((rs) => [...rs, { key: crypto.randomUUID(), kind: 'extra', order_item_id: null, label: '', quantity: 1, unit: '', shop: '', shop_order_ref: '' }]);
                      setDirty(true);
                    }}
                    className="min-h-11 text-[13px] font-semibold underline md:min-h-0"
                  >
                    + Add a row (a packing fee, a coupon as a minus)
                  </button>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-1.5 pt-2 text-right text-[15px] font-bold" aria-live="polite">
                {formatInr(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <label className="block space-y-1">
        <span className="text-ink-muted block text-[12px] font-semibold">Note (admins only)</span>
        <input value={note} maxLength={1000} disabled={locked} onChange={(e) => (setNote(e.target.value), setDirty(true))} className={input} />
      </label>
      <BillPhotos
        photos={photos}
        locked={locked}
        onFiles={upload}
        onRemove={(id) =>
          start(async () => {
            const result = await removeShopBillPhotoAction(orderId, id);
            setMessage(result.ok ? { ok: true, text: 'Photo removed.' } : { ok: false, text: result.error });
          })
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {locked ? (
          <>
            <span className="text-positive text-[13.5px] font-semibold">Final</span>
            <button
              type="button"
              className={secondaryButton}
              onClick={() =>
                start(async () => {
                  const r = await setShopBillFinalAction(orderId, false);
                  if (r.ok) setLocked(false);
                  setMessage(r.ok ? { ok: true, text: 'Reopened: the order’s timeline says so.' } : { ok: false, text: r.error });
                })
              }
            >
              Reopen to change it
            </button>
          </>
        ) : (
          <>
            <button type="submit" className={secondaryButton} disabled={pending}>
              Save draft
            </button>
            <button
              type="button"
              className={button}
              disabled={pending}
              onClick={() =>
                save(async () => {
                  const r = await setShopBillFinalAction(orderId, true);
                  if (r.ok) setLocked(true);
                  return r.ok ? { ok: true } : { ok: false, error: r.error };
                })
              }
            >
              Mark final
            </button>
            {dirty ? <span className="text-ink-muted text-[12.5px]">Not saved yet</span> : null}
          </>
        )}
        {message ? (
          <span role={message.ok ? 'status' : 'alert'} className={`text-[13px] ${message.ok ? 'text-ink-muted' : 'text-danger'}`}>
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

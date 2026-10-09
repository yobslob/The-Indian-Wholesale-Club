'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { listingSlug } from '@repo/shared/domain';

import { saveManyAction } from '../actions/listings';
import { button, input } from '../styles';

import { DropZone, usePhotoUploads } from './photo-grid';
import { livePrice, SellsFor, toPaise } from './sells-for';

import type { ListingFormData } from './new-listing';

interface Row {
  key: string;
  photos: string[];
  name: string;
  categoryId: string;
  vendorId: string;
  shopPrice: string;
  pieces: string;
}

const th = 'border-line text-ink-muted whitespace-nowrap border-b px-2 pb-2 text-left text-[11.5px] font-semibold uppercase tracking-[0.06em]';
const cell = `${input} md:h-[34px] text-[13px]`;

/**
 * Add many (D-096): drop a batch of photos and each starts its own draft; drag a photo onto another row (or "Join the
 * row above") to keep them together. One row per draft for name, category, shop, shop price (→ $ live) and pieces;
 * the shop, fabric and care apply to every row. "Create n drafts"; the rest can wait in Drafts.
 */
export function AddMany({ data }: { data: ListingFormData }): React.JSX.Element {
  const { photos, add } = usePhotoUploads();
  const [rows, setRows] = useState<Row[]>([]);
  const [batch, setBatch] = useState({ vendorId: '', fibre: '', care: '' });
  const [dragging, setDragging] = useState<string | null>(null);
  const [report, setReport] = useState<{ made: number; errors: string[] } | null>(null);
  const [pending, start] = useTransition();
  const suffix = useMemo(() => Math.random().toString(36).slice(2, 5), []);
  const seen = useRef(new Set<string>());
  const byKey = new Map(photos.map((p) => [p.key, p]));
  const categories = data.categories.filter((c) => c.product_type === 'clothing' && c.is_active);

  // Every new photo starts its own row.
  useEffect(() => {
    const fresh = photos.filter((p) => !seen.current.has(p.key));
    if (fresh.length === 0) return;
    for (const p of fresh) seen.current.add(p.key);
    setRows((list) => [...list, ...fresh.map((p) => ({ key: p.key, photos: [p.key], name: '', categoryId: '', vendorId: '', shopPrice: '', pieces: '1' }))]);
  }, [photos]);

  const set = (key: string, patch: Partial<Row>): void => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const join = (photo: string, into: string): void =>
    setRows((list) =>
      list
        .map((r) => (r.key === into ? { ...r, photos: [...r.photos.filter((k) => k !== photo), photo] } : { ...r, photos: r.photos.filter((k) => k !== photo) }))
        .filter((r) => r.photos.length > 0),
    );

  const create = (): void =>
    start(async () => {
      if (photos.some((p) => !p.path && !p.error)) return setReport({ made: 0, errors: ['Wait for the photos to finish uploading.'] });
      const ready = rows.map((r, i) => {
        const vendorId = r.vendorId || batch.vendorId;
        const cat = data.categories.find((c) => c.id === r.categoryId);
        return {
          input: {
            vendor_id: vendorId,
            category_id: r.categoryId,
            product_type: 'clothing',
            name: r.name.trim(),
            slug: listingSlug(r.name || 'listing', `${suffix}${i}`),
            shop_price_paise: toPaise(r.shopPrice) ?? undefined,
            attributes: { fibre_content: batch.fibre.trim(), care: batch.care.trim() },
            variants: [{ label: 'One size', options: {}, qty: Math.max(0, Math.round(Number(r.pieces) || 0)), ...(cat?.default_weight_g ? { weight_g: cat.default_weight_g } : {}) }],
          },
          photos: r.photos.flatMap((k, n) => {
            const p = byKey.get(k);
            return p?.path ? [{ path: p.path, alt: p.alt.trim() || `${r.name.trim() || 'Listing'}, photo ${n + 1}` }] : [];
          }),
        };
      });
      const results = await saveManyAction(ready);
      const failed = rows.filter((_, i) => 'error' in results[i]!);
      setReport({
        made: results.filter((r) => !('error' in r)).length,
        errors: rows.flatMap((r, i) => {
          const res = results[i]!;
          return 'error' in res ? [`Row ${i + 1}${r.name ? ` (${r.name})` : ''}: ${res.error}`] : [];
        }),
      });
      setRows(failed);
    });

  return (
    <>
      <DropZone onFiles={(files) => add(files)}>
        <span>
          <b className="text-ink">Drop a batch of photos</b>: each photo starts its own draft. Drag a photo onto another row to keep them together.
        </span>
      </DropZone>
      <div className="bg-surface my-3 grid gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] md:grid-cols-[1.4fr_1fr_1fr]">
        <label className="block space-y-1">
          <span className="text-ink-muted font-semibold">Shop (every row unless changed)</span>
          <select value={batch.vendorId} onChange={(e) => setBatch((b) => ({ ...b, vendorId: e.target.value }))} className={cell}>
            <option value="">Choose…</option>
            {data.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shop_name} · {v.region?.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-ink-muted font-semibold">Fabric (every row)</span>
          <input value={batch.fibre} onChange={(e) => setBatch((b) => ({ ...b, fibre: e.target.value }))} placeholder="100% cotton" className={cell} />
        </label>
        <label className="block space-y-1">
          <span className="text-ink-muted font-semibold">Care (every row)</span>
          <input value={batch.care} onChange={(e) => setBatch((b) => ({ ...b, care: e.target.value }))} placeholder="Hand wash, dry in shade" className={cell} />
        </label>
        <small className="text-ink-muted md:col-span-3">
          {photos.length} photo{photos.length === 1 ? '' : 's'} → {rows.length} draft{rows.length === 1 ? '' : 's'}. Clothing; fill what you know now, the rest can wait in Drafts.
        </small>
      </div>
      {report ? (
        <div role="status" className="border-line bg-paper mb-3 rounded-[10px] border px-3 py-2 text-[14px]">
          {report.made > 0 ? (
            <p>
              {report.made} draft{report.made === 1 ? '' : 's'} created ·{' '}
              <Link href="/admin/catalog?status=draft" className="underline">
                see Drafts
              </Link>
            </p>
          ) : null}
          {report.errors.map((e) => (
            <p key={e} className="text-danger">
              {e}
            </p>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="font-ui w-full min-w-[860px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th className={th}>Photos</th>
                <th className={th}>Name</th>
                <th className={th}>Category</th>
                <th className={th}>Shop</th>
                <th className={th}>Shop price ₹</th>
                <th className={th}>Sells for</th>
                <th className={`${th} text-right`}>Pieces</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const cat = data.categories.find((c) => c.id === r.categoryId);
                return (
                  <tr
                    key={r.key}
                    onDragOver={(e) => {
                      if (dragging) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!dragging) return;
                      e.preventDefault();
                      join(dragging, r.key);
                      setDragging(null);
                    }}
                    className="[&>td]:border-line align-top [&>td]:border-b [&>td]:p-2"
                  >
                    <td>
                      <span className="flex">
                        {r.photos.map((k, n) => {
                          const p = byKey.get(k);
                          return (
                            <span
                              key={k}
                              draggable
                              onDragStart={() => setDragging(k)}
                              onDragEnd={() => setDragging(null)}
                              title={p?.error ?? 'Drag onto another row to join it'}
                              className={`bg-land relative h-[54px] w-10 cursor-grab rounded-[7px] border-2 bg-cover bg-center ${n ? '-ml-3.5' : ''} ${p?.error ? 'border-danger' : 'border-paper'}`}
                              style={p ? { backgroundImage: `url(${p.preview})` } : undefined}
                            >
                              {p && !p.path && !p.error ? <i className="bg-ink absolute bottom-0 left-0 h-1" style={{ width: `${Math.round(p.progress * 100)}%` }} /> : null}
                            </span>
                          );
                        })}
                      </span>
                      {i > 0 ? (
                        <button type="button" onClick={() => r.photos.forEach((k) => join(k, rows[i - 1]!.key))} className="text-ink-muted mt-1 text-[12px] underline">
                          Join the row above
                        </button>
                      ) : null}
                    </td>
                    <td>
                      <input aria-label={`Name, row ${i + 1}`} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })} placeholder="Name" className={cell} />
                    </td>
                    <td>
                      <select aria-label={`Category, row ${i + 1}`} value={r.categoryId} onChange={(e) => set(r.key, { categoryId: e.target.value })} className={cell}>
                        <option value="">Choose…</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select aria-label={`Shop, row ${i + 1}`} value={r.vendorId || batch.vendorId} onChange={(e) => set(r.key, { vendorId: e.target.value })} className={cell}>
                        <option value="">Choose…</option>
                        {data.vendors.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.shop_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input aria-label={`Shop price in rupees, row ${i + 1}`} inputMode="decimal" value={r.shopPrice} onChange={(e) => set(r.key, { shopPrice: e.target.value })} placeholder="₹" className={cell} />
                    </td>
                    <td>
                      <SellsFor compact cents={livePrice(toPaise(r.shopPrice), cat?.default_weight_g ?? null, data.pricing)} />
                    </td>
                    <td>
                      <input aria-label={`Pieces, row ${i + 1}`} type="number" min="0" value={r.pieces} onChange={(e) => set(r.key, { pieces: e.target.value })} className={`${cell} w-20 text-right`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={pending || rows.length === 0} onClick={create} className={button}>
          {pending ? 'Creating…' : `Create ${rows.length} draft${rows.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </>
  );
}

'use client';

import { useState, useTransition } from 'react';

import { archiveListingsAction, moveListingsAction } from '../actions/categories';
import { button, input } from '../styles';

import type { CategoryOption, CategoryProposal } from './proposals';

type Row = CategoryProposal & { on: boolean; toId: string };

/**
 * Categories to check: each listing with the category it is in and the one its name reads as (changeable, ticked);
 * "Move the ticked" moves them at once. Below, the listings that are not their type at all, to archive or to open and
 * fix by hand. Rows leave the list as they are done; a refusal puts them back with a line (rule 0.1).
 */
export function CategoriesList({ proposals, categories }: { proposals: CategoryProposal[]; categories: CategoryOption[] }): React.JSX.Element {
  const [rows, setRows] = useState<Row[]>(() => proposals.map((p) => ({ ...p, on: true, toId: p.to?.id ?? '' })));
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();
  const moves = rows.filter((r) => r.to);
  const others = rows.filter((r) => !r.to);
  const tickedMoves = moves.filter((r) => r.on && r.toId);
  const tickedOthers = others.filter((r) => r.on);

  const run = (done: Row[], call: () => Promise<{ ok: true; done: number } | { ok: false; error: string }>, said: (n: number) => string): void => {
    const before = rows;
    const gone = new Set(done.map((r) => r.id));
    setRows((rs) => rs.filter((r) => !gone.has(r.id)));
    setMessage('Saving…');
    start(async () => {
      const result = await call();
      if (!result.ok) {
        setRows(before);
        setMessage(result.error);
      } else setMessage(said(result.done));
    });
  };
  const toggle = (list: Row[]): void => {
    const all = list.every((r) => r.on);
    const ids = new Set(list.map((r) => r.id));
    setRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, on: !all } : r)));
  };
  const set = (rowId: string, patch: Partial<Row>): void => setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  const link = (r: Row): React.JSX.Element => (
    <span className="min-w-0 text-[13px]">
      <a href={`/admin/catalog/${r.id}`} className="underline">
        {r.name}
      </a>
      <small className="text-ink-muted block">
        {r.status} · now in {r.from.name}
        {r.reason ? ` · ${r.reason}` : ''}
      </small>
    </span>
  );

  return (
    <div className="space-y-6">
      {message ? (
        <p role="status" className="text-ink-muted text-[13px]">
          {message}
        </p>
      ) : null}
      {moves.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={button}
              disabled={tickedMoves.length === 0}
              onClick={() =>
                run(tickedMoves, () => moveListingsAction(tickedMoves.map((r) => ({ id: r.id, categoryId: r.toId }))), (n) => `Moved ${n}.`)
              }
            >
              Move the {tickedMoves.length} ticked
            </button>
            <button type="button" className="min-h-11 text-[13px] underline" onClick={() => toggle(moves)}>
              Tick all / none
            </button>
          </div>
          <ul className="border-line divide-line bg-paper divide-y rounded-[14px] border">
            {moves.map((r) => (
              <li key={r.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 px-3 py-2 md:grid-cols-[44px_minmax(0,1fr)_220px]">
                <input type="checkbox" checked={r.on} aria-label={`Move ${r.name}`} onChange={(e) => set(r.id, { on: e.target.checked })} className="h-5 w-5 justify-self-center" />
                {link(r)}
                <select
                  aria-label={`Category for ${r.name}`}
                  value={r.toId}
                  onChange={(e) => set(r.id, { toId: e.target.value, on: true })}
                  className={`${input} col-start-2 md:col-start-auto`}
                >
                  {categories
                    .filter((c) => c.product_type === r.productType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {others.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-[15px] font-semibold">Not their type at all ({others.length})</h2>
          <p className="text-ink-muted text-[13px]">
            Archive them (customers stop seeing them; each can be brought back from its page), or open one to give it the
            right type and category by hand.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={button}
              disabled={tickedOthers.length === 0}
              onClick={() => run(tickedOthers, () => archiveListingsAction(tickedOthers.map((r) => r.id)), (n) => `Archived ${n}.`)}
            >
              Archive the {tickedOthers.length} ticked
            </button>
            <button type="button" className="min-h-11 text-[13px] underline" onClick={() => toggle(others)}>
              Tick all / none
            </button>
          </div>
          <ul className="border-line divide-line bg-paper divide-y rounded-[14px] border">
            {others.map((r) => (
              <li key={r.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 px-3 py-2">
                <input type="checkbox" checked={r.on} aria-label={`Archive ${r.name}`} onChange={(e) => set(r.id, { on: e.target.checked })} className="h-5 w-5 justify-self-center" />
                {link(r)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

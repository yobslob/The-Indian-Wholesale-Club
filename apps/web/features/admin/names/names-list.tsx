'use client';

import { useState, useTransition } from 'react';

import { renameListingsAction } from '../actions/catalog';
import { button, input } from '../styles';

import type { NameProposal } from './proposals';

/**
 * Names to tidy (D-140, L1): the shop's title and IWC's name side by side, each editable and ticked; Apply renames the
 * ticked ones at once (they leave the list) and goes back with a line if the server refuses (rule 0.1).
 */
export function NamesList({ proposals }: { proposals: NameProposal[] }): React.JSX.Element {
  const [rows, setRows] = useState(() => proposals.map((p) => ({ ...p, on: true })));
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();
  const ticked = rows.filter((r) => r.on && r.to.trim().length >= 2);

  const apply = (): void => {
    const sent = ticked.map((r) => ({ id: r.id, name: r.to.trim() }));
    const before = rows;
    setRows((rs) => rs.filter((r) => !(r.on && r.to.trim().length >= 2)));
    setMessage(`Renaming ${sent.length}…`);
    start(async () => {
      const result = await renameListingsAction(sent);
      if (!result.ok) {
        setRows(before);
        setMessage(result.error);
      } else setMessage(`Renamed ${result.renamed}. The shop's title is kept on each listing.`);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={button} disabled={ticked.length === 0} onClick={apply}>
          Rename the {ticked.length} ticked
        </button>
        <button type="button" className="min-h-11 text-[13px] underline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, on: !rs.every((x) => x.on) })))}>
          Tick all / none
        </button>
        {message ? (
          <span role="status" className="text-ink-muted text-[13px]">
            {message}
          </span>
        ) : null}
      </div>
      <ul className="border-line divide-line bg-paper divide-y rounded-[14px] border">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-2 px-3 py-2 md:grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)]">
            <input
              type="checkbox"
              checked={r.on}
              aria-label={`Rename ${r.from}`}
              onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, on: e.target.checked } : x)))}
              className="h-5 w-5 justify-self-center"
            />
            <span className="text-ink-muted min-w-0 text-[13px]">
              <a href={`/admin/catalog/${r.id}`} className="underline">
                {r.from}
              </a>
              <small className="block">{r.status}</small>
            </span>
            <input
              aria-label={`New name for ${r.from}`}
              value={r.to}
              maxLength={120}
              onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, to: e.target.value, on: true } : x)))}
              className={`${input} col-start-2 md:col-start-auto`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

/**
 * The shelf's chips (plan §4.2): filter the server-drawn cards by kind without a reload (D-136), kept in `?kind=` so a
 * shared link opens the same shelf. The page stays one cached page: the filter runs in the browser.
 */
export function ShelfChips({ kinds, labels }: { kinds: string[]; labels: Record<string, string> }): React.JSX.Element {
  const [kind, setKind] = useState<string | null>(null);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('kind');
    if (k && kinds.includes(k)) setKind(k);
  }, [kinds]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-shelf] [data-kind]').forEach((el) => {
      el.closest('li')!.hidden = kind !== null && el.dataset.kind !== kind;
    });
    const url = new URL(window.location.href);
    if (kind) url.searchParams.set('kind', kind);
    else url.searchParams.delete('kind');
    window.history.replaceState(window.history.state, '', url);
  }, [kind]);

  const chip = (k: string | null, label: string): React.JSX.Element => (
    <button
      key={k ?? 'all'}
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={`font-ui rounded-pill h-10 whitespace-nowrap border px-4 text-[14px] font-medium ${
        kind === k ? 'bg-ink text-paper border-ink' : 'border-line bg-paper text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Kind of dish" className="-mx-[var(--gut)] flex gap-2 overflow-x-auto px-[var(--gut)] pb-1">
      {chip(null, 'All')}
      {kinds.map((k) => chip(k, labels[k] ?? k))}
    </div>
  );
}

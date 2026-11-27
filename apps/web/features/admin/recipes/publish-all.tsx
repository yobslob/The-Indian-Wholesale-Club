'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { publishAllAction } from '../actions/recipes';
import { button } from '../styles';

const WHY: Record<string, string> = { no_iwc_line: 'no piece of its kit is on IWC yet' };

/**
 * Publish all (D-204, founder 2026-11-23: "Publish all … in listings pick the cheapest one on our website by default and
 * publish, I will change later if required"; D-213: a line with no listing moves to the local shop). Repeats the batch
 * until every draft has been through (D-146), then lists what is still waiting and why.
 */
export function RecipesPublishAll({ drafts }: { drafts: number }): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    published: number;
    filled: number;
    local: number;
    blocked: string[];
    error: string | null;
  } | null>(null);

  async function run(): Promise<void> {
    setBusy(true);
    let after: string | null = null;
    let published = 0;
    let filled = 0;
    let local = 0;
    const blocked: string[] = [];
    let error: string | null = null;
    for (let i = 0; i < 100; i++) {
      const r = await publishAllAction(after);
      if (r.error) {
        error = r.error;
        break;
      }
      published += r.published.length;
      filled += r.filled;
      local += r.local;
      blocked.push(
        ...r.blocked.map((b) => `${b.slug}: ${b.why.map((w) => WHY[w] ?? w).join(', ')}`),
      );
      setDone({ published, filled, local, blocked: [...blocked], error: null });
      if (!r.next) break;
      after = r.next;
    }
    setDone({ published, filled, local, blocked, error });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={button}
        disabled={busy || drafts === 0}
        onClick={() => void run()}
      >
        {busy ? 'Publishing…' : `Publish all ${drafts} drafts`}
      </button>
      {done ? (
        <div className="text-sm" role="status">
          {done.error ? <p className="text-danger">{done.error}</p> : null}
          <p>
            {done.published} published · {done.filled} ingredients matched to the cheapest listing ·{' '}
            {done.local} with no listing moved to the local shop.
          </p>
          {done.blocked.length ? (
            <p className="text-ink-muted">Still drafts: {done.blocked.join('; ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

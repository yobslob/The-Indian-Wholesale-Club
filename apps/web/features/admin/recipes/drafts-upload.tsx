'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { addDraftsAction } from '../actions/recipes';
import { secondaryButton } from '../styles';

/** D-203, plan §7: a JSON file of drafted recipes in; each comes in as a draft with draft words. */
export function RecipeDraftsUpload(): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    error: string | null;
    added: string[];
    replaced: string[];
    skipped: string[];
  } | null>(null);

  async function send(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    const r = await addDraftsAction(await file.text());
    setBusy(false);
    setResult(r);
    if (r.added.length || r.replaced.length) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className={`${secondaryButton} cursor-pointer`}>
        {busy ? 'Adding…' : 'Choose a file…'}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            void send(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {result ? (
        <div className="text-sm" role="status">
          {result.error ? <p className="text-danger">{result.error}</p> : null}
          {!result.error ? (
            <p>
              {result.added.length} added
              {result.replaced.length ? `, ${result.replaced.length} drafts replaced` : ''}.
            </p>
          ) : null}
          {result.skipped.length ? (
            <p className="text-ink-muted">Left out: {result.skipped.join('; ')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

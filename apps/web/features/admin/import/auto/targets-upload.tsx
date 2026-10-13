'use client';

import { useState, useTransition } from 'react';

import { secondaryButton } from '../../styles';

import { uploadTargetsAction, type UploadResult } from './actions';

/**
 * Adds targets from a CSV (D-118): the state bestseller list as it is, or any sheet with the columns Product, Type,
 * IWC category, IWC region slug (and optionally Tier, Search words, Must match). Rows already there are skipped.
 */
export function TargetsUpload(): React.JSX.Element {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pending, start] = useTransition();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) return setResult({ error: 'That file is over 2 MB.' });
    start(async () => setResult(await uploadTargetsAction(await file.text())));
  };
  return (
    <div className="space-y-2">
      <label className={`${secondaryButton} cursor-pointer`}>
        {pending ? 'Adding…' : 'Add targets from a CSV'}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onFile}
          disabled={pending}
        />
      </label>
      {result ? (
        'error' in result ? (
          <p role="alert" className="text-danger text-[14px]">
            {result.error}
          </p>
        ) : (
          <div role="status" className="text-[14px]">
            <p>
              {result.added} added{result.skipped ? `, ${result.skipped} already there` : ''}
              {result.errors.length ? `, ${result.errors.length} not read:` : '.'}
            </p>
            {result.errors.length ? (
              <ul className="text-ink-muted list-disc pl-5 text-[13px]">
                {result.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

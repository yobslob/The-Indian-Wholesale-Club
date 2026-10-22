'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { finishBulkAction, renameAllStepAction } from '../actions/bulk';
import { ConfirmButton } from '../confirm';
import { button } from '../styles';

/**
 * Names to tidy → Rename all (D-146): every proposal on every page, as proposed, 250 a batch until none is left. The
 * old names stay as each listing's shop title (admin only), so nothing is lost.
 */
export function RenameAll({ total }: { total: number }): React.JSX.Element {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  const go = async (): Promise<void> => {
    setRunning(true);
    let renamed = 0;
    let error: string | null = null;
    for (let i = 0; i < 60; i += 1) {
      const r = await renameAllStepAction();
      if (!r.ok) {
        error = r.error;
        break;
      }
      renamed += r.value.renamed;
      setLine(`Renaming… ${renamed.toLocaleString('en-US')} done, ${r.value.left.toLocaleString('en-US')} to go.`);
      if (r.value.left === 0 || r.value.renamed === 0) break;
    }
    await finishBulkAction();
    setLine(error ?? `Renamed ${renamed.toLocaleString('en-US')}. Each old name is kept as the listing's shop title.`);
    setRunning(false);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {running ? (
        <button type="button" className={button} disabled>
          Working…
        </button>
      ) : (
        <ConfirmButton
          label={`Rename all ${total.toLocaleString('en-US')}`}
          className={button}
          title={`Rename all ${total.toLocaleString('en-US')}?`}
          confirm="Rename them"
          danger={false}
          action={async () => void go()}
        >
          Every name on every page of this list takes IWC&rsquo;s name as shown (only the brand or shop goes, D-143), live
          and draft alike. Each old name stays on its listing as the shop title (admin only). To change or skip one, edit
          or untick it on its page and use Rename the ticked first.
        </ConfirmButton>
      )}
      {line ? (
        <span role="status" className="text-ink-muted text-[13px]">
          {line}
        </span>
      ) : null}
    </div>
  );
}

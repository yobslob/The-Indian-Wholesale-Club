'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  acceptWeightsStepAction,
  archiveUnreadyAction,
  assignWeightsStepAction,
  finishBulkAction,
  publishStepAction,
} from '../actions/bulk';
import { ConfirmButton } from '../confirm';
import { button, secondaryButton } from '../styles';

const n = (x: number): string => x.toLocaleString('en-US');

/** Calls one batch until it says nothing is left (or it stops moving), reporting each batch. */
async function untilDone<T>(
  run: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>,
  each: (value: T) => boolean,
): Promise<string | null> {
  for (let i = 0; i < 300; i += 1) {
    const r = await run();
    if (!r.ok) return r.error;
    if (!each(r.value)) return null;
  }
  return null;
}

/**
 * D-146: Weights to check and Drafts → one press: every option without a weight gets one (the house rules, else the
 * middle weight of similar pieces weighed before, else the category's usual weight), every weight Weights to check
 * shows is accepted (Weights to check only), then every ready draft goes live. Batches run one after another with
 * the count on screen; if one fails, pressing again carries on.
 */
export function AssignAndPublish({ accept, label }: { accept: boolean; label: string }): React.JSX.Element {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [held, setHeld] = useState(0);

  const go = async (): Promise<void> => {
    setRunning(true);
    const w = { ruled: 0, similar: 0, usual: 0, listings: 0 };
    let accepted = 0;
    const p = { published: 0, missing: 0, held: 0 };
    let error = await untilDone(assignWeightsStepAction, (v) => {
      w.ruled += v.ruled;
      w.similar += v.similar;
      w.usual += v.usual;
      w.listings += v.listings;
      setLine(`Weighing… ${n(w.listings)} listings done, ${n(v.left)} to go.`);
      return v.listings > 0 && v.ruled + v.similar + v.usual > 0;
    });
    if (!error && accept)
      error = await untilDone(acceptWeightsStepAction, (v) => {
        accepted += v;
        setLine(`Accepting the weights shown… ${n(accepted)} options.`);
        return v > 0;
      });
    if (!error)
      error = await untilDone(publishStepAction, (v) => {
        p.published += v.published;
        p.missing += v.live_missing_details;
        p.held = v.no_photo + v.no_option + v.no_stock + v.no_weight + v.refused;
        setLine(`Publishing… ${n(p.published)} live, ${n(v.left)} to go.`);
        return v.left > 0 && v.published > 0;
      });
    await finishBulkAction();
    setHeld(p.held);
    const weighed = w.ruled + w.similar + w.usual;
    setLine(
      [
        error,
        weighed
          ? `${n(weighed)} options weighed: ${n(w.ruled)} by the house rules, ${n(w.similar)} like similar pieces weighed before, ${n(w.usual)} at their category's usual weight (marked "Estimated"; the hub's scale and the runner's page reads replace them).`
          : 'Every option already had a weight.',
        accept ? `${n(accepted)} shown weights accepted.` : '',
        `${n(p.published)} drafts published${p.missing ? ` (${n(p.missing)} still lack details customers see: finish them from Live)` : ''}.`,
        p.held ? `${n(p.held)} drafts cannot go live (no photo, no option or nothing to sell).` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
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
        <ConfirmButton label={label} className={button} title={`${label}?`} confirm="Go ahead" danger={false} action={async () => void go()}>
          Every option without a weight gets one: clothing by its class, food by the net quantity on its label, the rest
          the middle weight of the most similar pieces weighed before (else the category&rsquo;s usual weight), marked
          &ldquo;Estimated&rdquo; and repriced. {accept ? 'Every weight this tab shows is accepted as it is. ' : ''}Then every
          draft with a photo, an option and a piece to sell goes live at its new price. Weights typed or weighed are
          never changed; demo listings and US clearance pieces are not touched. It takes a minute or two for thousands.
        </ConfirmButton>
      )}
      {line ? (
        <p role="status" className="text-sm">
          {line}
        </p>
      ) : null}
      {held > 0 && !running ? <ArchiveUnready /> : null}
    </div>
  );
}

/** Drafts → archive the drafts that cannot go live, so Drafts holds only the next batch (D-146). */
export function ArchiveUnready(): React.JSX.Element {
  const router = useRouter();
  const [line, setLine] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <ConfirmButton
        label="Archive the drafts that can't go live"
        className={secondaryButton}
        title="Archive the drafts that can't go live?"
        confirm="Archive them"
        action={async () => {
          const r = await archiveUnreadyAction();
          setLine(
            r.ok
              ? `Archived ${n(r.value.no_photo + r.value.no_option + r.value.no_stock)}: ${n(r.value.no_photo)} without a photo, ${n(r.value.no_option)} without an active option, ${n(r.value.no_stock)} with nothing to sell. Products → All finds them; publish one again by hand after fixing it.`
              : r.error,
          );
          router.refresh();
        }}
      >
        Drafts without a photo, an active option or a piece to sell move to Archived, so Drafts holds only the next batch.
        Nothing is deleted: each can be fixed and published again from its page.
      </ConfirmButton>
      {line ? (
        <span role="status" className="text-sm">
          {line}
        </span>
      ) : null}
    </span>
  );
}

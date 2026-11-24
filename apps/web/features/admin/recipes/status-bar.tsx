'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { approveRecipeAction, pinRecipeAction, setRecipeStatusAction } from '../actions/recipes';
import { button, secondaryButton } from '../styles';

const BLOCKERS: Record<string, string> = {
  words_not_approved: 'The words are not approved yet.',
  no_iwc_line:
    'Nothing in the kit can be bought yet: pick a live listing for at least one IWC ingredient.',
};

/**
 * The editor's kit-health strip (D-203): what still blocks publishing (the database's own publish rule), and the
 * buttons: approve the words, publish or take off the store, On Home's window.
 */
export function RecipeStatusBar({
  recipeId,
  status,
  approved,
  onHome,
  blockers,
}: {
  recipeId: string;
  status: 'draft' | 'live' | 'archived';
  approved: boolean;
  onHome: boolean;
  blockers: string[];
}): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (act: () => Promise<{ error: string | null }>): void =>
    start(async () => {
      const r = await act();
      setError(r.error);
      router.refresh();
    });

  return (
    <section
      className={`rounded-[14px] border px-[18px] py-4 ${status === 'live' ? 'border-positive/30 bg-positive/[0.06]' : 'border-caution/25 bg-caution/[0.06]'}`}
    >
      <p className="font-semibold">
        {status === 'live'
          ? 'Live on the store'
          : status === 'archived'
            ? 'Archived'
            : 'Draft: customers don’t see it'}
        {onHome ? ' · on Home’s window' : ''}
      </p>
      {status !== 'live' && blockers.length > 0 ? (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {blockers.map((b) => (
            <li key={b}>{BLOCKERS[b] ?? b}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={() => run(() => approveRecipeAction(recipeId, !approved))}
        >
          {approved ? 'Words approved · undo' : 'Approve the words'}
        </button>
        {status === 'live' ? (
          <button
            type="button"
            className={secondaryButton}
            disabled={pending}
            onClick={() => run(() => setRecipeStatusAction(recipeId, 'draft'))}
          >
            Take off the store
          </button>
        ) : (
          <button
            type="button"
            className={button}
            disabled={pending || blockers.length > 0}
            onClick={() => run(() => setRecipeStatusAction(recipeId, 'live'))}
          >
            Publish
          </button>
        )}
        {status === 'live' ? (
          <label className="font-ui inline-flex min-h-11 items-center gap-2 text-[14px] font-semibold">
            <input
              type="checkbox"
              className="size-5"
              checked={onHome}
              disabled={pending}
              onChange={(e) => run(() => pinRecipeAction(e.target.checked ? recipeId : null))}
            />
            On Home&rsquo;s window
          </label>
        ) : null}
        {status === 'draft' ? (
          <button
            type="button"
            className={secondaryButton}
            disabled={pending}
            onClick={() => run(() => setRecipeStatusAction(recipeId, 'archived'))}
          >
            Archive
          </button>
        ) : null}
        {status === 'archived' ? (
          <button
            type="button"
            className={secondaryButton}
            disabled={pending}
            onClick={() => run(() => setRecipeStatusAction(recipeId, 'draft'))}
          >
            Back to drafts
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}

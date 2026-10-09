'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { reviewFormStateAction, type ReviewFormState } from './actions';

// The panel's insides load when it first opens, not with the product page (engineering.md §Budgets): most visitors
// never open it. The click starts both downloads while the server says who is signed in.
const loadSignIn = () => import('@/features/auth/sign-in-card');
const loadForm = () => import('./review-form');
const waiting = () => <p className="text-ink-muted text-sm">Loading…</p>;
const SignInCard = dynamic(() => loadSignIn().then((m) => m.SignInCard), { loading: waiting });
const ReviewForm = dynamic(() => loadForm().then((m) => m.ReviewForm), { loading: waiting });

const pill =
  'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 items-center rounded-pill border px-5 text-sm font-medium';

/**
 * "Write a review" on the product page (D-090): opens the form as a side panel over the product, with the menu's
 * motion (D-079, globals.css .site-panel); signed out, the sign-in card comes first, then the form in the same panel.
 * It stays a link to /account/reviews/[productId], so a new tab or no JavaScript still reach the form. The panel asks
 * the server who is signed in only when it opens, so the product page stays static (PR-1).
 */
export function WriteReview({ productId }: { productId: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ReviewFormState | null>(null);
  const link = useRef<HTMLAnchorElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    void loadSignIn();
    void loadForm();
    setState(null);
    void reviewFormStateAction(productId).then(setState);
  }, [productId]);
  const shut = useCallback(() => {
    setOpen(false);
    link.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') shut();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, shut]);

  return (
    <>
      <Link
        ref={link}
        href={`/account/reviews/${productId}`}
        className={pill}
        aria-controls="review-panel"
        aria-expanded={open}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
          load();
        }}
      >
        Write a review
      </Link>
      <div className="site-scrim" data-open={open || undefined} aria-hidden="true" onClick={shut} />
      <aside id="review-panel" className="site-panel bag-panel review-panel font-ui" data-open={open || undefined} aria-label="Write a review">
        <header className="border-line flex items-center justify-between border-b py-2 pl-5 pr-2">
          <h2 className="font-heading m-0 text-[22px] font-medium leading-none text-[#1D1A17]">Write a review</h2>
          <button ref={close} type="button" className="site-icon" aria-label="Close" onClick={shut}>
            <HeaderIcon name="close" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-[18px]" data-lenis-prevent>
          {!open ? null : state === null ? (
            <p className="text-ink-muted text-sm">Loading…</p>
          ) : !state.signedIn ? (
            <SignInCard onDone={load} why="Sign in to write your review." />
          ) : state.piece === null ? (
            <p className="text-ink-muted text-sm">This piece can&apos;t be reviewed right now.</p>
          ) : (
            <ReviewForm piece={state.piece} verified={state.verified} reviewed={state.reviewed} displayName={state.displayName} />
          )}
        </div>
      </aside>
    </>
  );
}

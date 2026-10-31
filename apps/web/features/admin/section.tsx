'use client';

import { useRouter } from 'next/navigation';
import { Component, Suspense, useTransition } from 'react';

/**
 * One part of an admin page that loads on its own: the rest of the page shows while it loads, and if its read fails
 * (a busy database, a dropped connection) only this part says so, with Load again, instead of the whole page.
 */
export function Section({
  fallback,
  failed,
  children,
}: {
  /** What shows while the part loads: the same frame without its numbers or rows. */
  fallback: React.ReactNode;
  /** What shows if it fails, when a quiet stand-in is better than Load again (tabs without their counts). */
  failed?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SectionBoundary failed={failed}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SectionBoundary>
  );
}

/** A one-line "did not load" with Load again, which reads the page's data again and keeps everything else. */
export function LoadAgain({
  what,
  onReset,
}: {
  what: string;
  onReset?: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <p
      role="alert"
      className="border-line text-ink-muted rounded-xl border px-3.5 py-3 text-[14px]"
    >
      {what} did not load (the database was busy).{' '}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(() => {
            router.refresh();
            onReset?.();
          })
        }
        className="text-ink min-h-11 font-semibold underline disabled:opacity-60"
      >
        {pending ? 'Loading…' : 'Load again'}
      </button>
    </p>
  );
}

type State = { error: unknown };

type Props = { failed?: React.ReactNode; children: React.ReactNode };

class SectionBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  // new content from the server (another page, filter or tab, or Load again) gets a fresh try
  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.children !== this.props.children) this.setState({ error: null });
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    // Next's own signals (redirect, not found) are not failures: they go on to the page's handlers
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw error;
    return (
      this.props.failed ?? (
        <LoadAgain what="This part" onReset={() => this.setState({ error: null })} />
      )
    );
  }
}

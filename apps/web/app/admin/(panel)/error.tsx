'use client';

import { LoadAgain } from '@/features/admin/section';

/** An admin page whose reads failed: the frame stays, and Load again reads the page once more (no internals shown). */
export default function AdminPageError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return <LoadAgain what="This page" onReset={reset} />;
}

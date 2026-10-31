'use client';

import { LoadAgain } from '@/features/admin/section';

/** The frame's own reads failed (the sign-in check): the same Load again as a page, without the frame. */
export default function AdminError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <LoadAgain what="This page" onReset={reset} />
    </div>
  );
}

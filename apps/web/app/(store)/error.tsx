'use client';

import { ErrorMessage } from '@/features/shell/error-message';

/** Storefront error boundary (D-093): inside the store layout, so the header and footer stay; no internals shown. */
export default function StoreError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return <ErrorMessage kind="error" onRetry={reset} />;
}

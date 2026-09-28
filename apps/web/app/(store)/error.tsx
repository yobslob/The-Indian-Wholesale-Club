'use client';

/** Storefront error boundary: generic message, no internals (engineering.md conventions). */
export default function StoreError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-ink text-xl font-semibold">Something went wrong</h1>
      <button type="button" onClick={reset} className="min-h-11 underline">
        Try again
      </button>
    </div>
  );
}

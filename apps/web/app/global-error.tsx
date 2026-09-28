'use client';

/** Last-resort error page (replaces the root layout when it fails). */
export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center' }}
      >
        <h1>Something went wrong</h1>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}

'use client';

import { useEffect } from 'react';

import { SITE_NAME } from '@repo/shared/constants';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): React.JSX.Element {
  useEffect(() => {
    console.error('Global application error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-white px-4 font-sans text-neutral-900 antialiased">
        <div className="mx-auto max-w-md text-center">
          <div className="text-3xl font-bold tracking-tight">{SITE_NAME}</div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-neutral-900">
            Application Error
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            A critical system error occurred. We apologize for the inconvenience. Please try
            refreshing or return to the homepage.
          </p>

          {error.digest && (
            <p className="mt-3 font-mono text-xs text-neutral-400">Error Digest: {error.digest}</p>
          )}

          <div className="mt-8 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Try Again
            </button>

            <a
              href="/"
              className="rounded-md border border-neutral-300 bg-white px-6 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Go to Homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

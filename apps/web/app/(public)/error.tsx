'use client';

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PublicError({ error, reset }: ErrorProps): React.JSX.Element {
  useEffect(() => {
    // Log error to monitoring
    console.error('Public route error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="text-destructive flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h1 className="font-display mt-6 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
        Something went wrong
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-neutral-600">
        We encountered an unexpected error while loading this page. Our team has been notified, and
        we are working to resolve the issue.
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-neutral-400">Error Reference: {error.digest}</p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-colors hover:bg-neutral-800"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Return Home
        </Link>
      </div>

      <div className="mt-12 text-xs text-neutral-400">
        Need assistance?{' '}
        <Link href="/contact" className="underline underline-offset-4 hover:text-neutral-700">
          Contact our support team
        </Link>
      </div>
    </div>
  );
}

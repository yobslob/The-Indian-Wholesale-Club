'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import React from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="shadow-xs mx-auto my-12 max-w-lg rounded-xl border border-zinc-200 bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-zinc-900">Admin Portal Error</h2>
      <p className="mb-6 mt-2 text-xs text-zinc-500">
        {error.message || 'An unexpected error occurred while loading this administrative view.'}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        Retry Operation
      </button>
    </div>
  );
}

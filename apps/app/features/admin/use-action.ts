import { useCallback, useState } from 'react';

import { DbError } from '@repo/db';

import { apiPost } from '@/lib/api';

/** What a write moved on the store (POST /admin/revalidate, D-189). */
export interface StoreRefresh {
  listings?: string[];
  products?: string[];
  pickups?: string[];
}

/**
 * Runs one admin write with a busy flag and a readable error. The database
 * decides (RLS + is_admin(), SQL rules); the phone only shows the answer.
 * Admin-only screens, so the SQL error code is shown to help the operator. A write customers can see names what moved
 * and the website refreshes those pages (B-17); if that call fails, its day's fallback still does. Most admin work moves
 * nothing customers see, so it names nothing and costs no page-cache writes.
 */
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (task: () => Promise<unknown>, refresh?: StoreRefresh): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await task();
        if (refresh) void apiPost('/admin/revalidate', refresh);
        onDone?.();
        return true;
      } catch (err) {
        setError(
          err instanceof DbError
            ? `Refused: ${err.code}${err.detail ? ` (${err.detail})` : ''}`
            : 'No connection. Try again.',
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  return { busy, error, run };
}

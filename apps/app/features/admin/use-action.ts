import { useCallback, useState } from 'react';

import { DbError } from '@repo/db';

/**
 * Runs one admin write with a busy flag and a readable error. The database
 * decides (RLS + is_admin(), SQL rules); the phone only shows the answer.
 * Admin-only screens, so the SQL error code is shown to help the operator.
 */
export function useAction(onDone?: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (task: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await task();
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

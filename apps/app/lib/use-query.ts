import { useCallback, useEffect, useRef, useState } from 'react';

import { DbError } from '@repo/db';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** supabase-js reports an unreachable server as an error result, which unwrap() turns into a DbError. */
function isNetworkFailure(err: DbError): boolean {
  return /network request failed|failed to fetch|fetch failed/i.test(err.message);
}

/** Loads data for a screen; `key` changes reload it. Errors become a plain message (no internals). */
export function useQuery<T>(key: string, load: () => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadRef
      .current()
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        // Development only: the real reason goes to the Metro terminal.
        if (__DEV__) console.warn(`[load ${key}]`, err);
        if (!active) return;
        setError(
          err instanceof DbError && !isNetworkFailure(err)
            ? 'Could not load. Pull to try again.'
            : 'No connection. Pull to try again.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

import { useCallback, useEffect, useRef, useState } from 'react';

import { DbError } from '@repo/db';

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  /** True while there is nothing to show yet, and during a pull to refresh (not during a quiet background refresh). */
  loading: boolean;
  reload: () => void;
}

/**
 * The last result per key, kept in memory (newest 40): going back to a screen, or opening it again, shows it at once
 * while a fresh copy loads quietly behind it. Emptied on sign-in and sign-out (lib/session.tsx), so one person's
 * orders never show to the next.
 */
const MAX_ENTRIES = 40;
const results = new Map<string, unknown>();

function remember(key: string, value: unknown): void {
  results.delete(key);
  results.set(key, value);
  if (results.size > MAX_ENTRIES) results.delete(results.keys().next().value as string);
}

export function clearQueryCache(): void {
  results.clear();
}

/** supabase-js reports an unreachable server as an error result, which unwrap() turns into a DbError. */
function isNetworkFailure(err: DbError): boolean {
  return /network request failed|failed to fetch|fetch failed/i.test(err.message);
}

/** Loads data for a screen; `key` changes reload it. Errors become a plain message (no internals). */
export function useQuery<T>(key: string, load: () => Promise<T>): QueryState<T> {
  const [data, setData] = useState<T | undefined>(() => results.get(key) as T | undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !results.has(key));
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const pulled = useRef(false);

  useEffect(() => {
    let active = true;
    const cached = results.get(key) as T | undefined;
    if (cached !== undefined) setData(cached);
    // A spinner only when there is nothing to show, or when the person pulled to refresh.
    setLoading(cached === undefined || pulled.current);
    pulled.current = false;
    loadRef
      .current()
      .then((result) => {
        remember(key, result);
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

  const reload = useCallback(() => {
    pulled.current = true;
    setTick((t) => t + 1);
  }, []);
  return { data, error, loading, reload };
}

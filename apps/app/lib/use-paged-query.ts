import { useCallback, useEffect, useRef, useState } from 'react';

import { DbError } from '@repo/db';

export interface PagedState<T> {
  items: T[] | undefined;
  error: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/**
 * A long list loaded a page at a time (founder, 2026-10-06: pagination wherever many photos slow the screen). The
 * first page loads on `key`; `loadMore` appends the next one (a FlatList's onEndReached or a "Show more" button).
 * A page shorter than `pageSize` means there is no more.
 */
export function usePagedQuery<T>(
  key: string,
  loadPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = 24,
): PagedState<T> {
  const [items, setItems] = useState<T[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(loadPage);
  loadRef.current = loadPage;
  const generation = useRef(0);

  const fail = (err: unknown): void => {
    if (__DEV__) console.warn(`[load ${key}]`, err);
    setError(
      err instanceof DbError && !/network request failed|failed to fetch/i.test(err.message)
        ? 'Could not load. Pull to try again.'
        : 'No connection. Pull to try again.',
    );
  };

  useEffect(() => {
    const mine = ++generation.current;
    setLoading(true);
    loadRef
      .current(0, pageSize)
      .then((page) => {
        if (mine !== generation.current) return;
        setItems(page);
        setHasMore(page.length === pageSize);
        setError(null);
      })
      .catch((err: unknown) => mine === generation.current && fail(err))
      .finally(() => mine === generation.current && setLoading(false));
    // Reloads on the key and on reload() only (loadPage changes every render; the ref holds the latest).
  }, [key, tick, pageSize]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || !items) return;
    const mine = generation.current;
    setLoadingMore(true);
    loadRef
      .current(items.length, pageSize)
      .then((page) => {
        if (mine !== generation.current) return;
        setItems((current) => [...(current ?? []), ...page]);
        setHasMore(page.length === pageSize);
      })
      .catch((err: unknown) => mine === generation.current && fail(err))
      .finally(() => mine === generation.current && setLoadingMore(false));
    // fail() only reads the key.
  }, [loading, loadingMore, hasMore, items, pageSize]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { items, error, loading, loadingMore, hasMore, loadMore, reload };
}

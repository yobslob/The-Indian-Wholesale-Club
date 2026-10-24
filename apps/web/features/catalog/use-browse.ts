'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { PRODUCT_TYPE_PATH, type ProductType } from '@repo/shared/domain';

import { browseHref, browseSearch, inQuickStore, inStatePage, PAGE, parseBrowseQuery, sameQuery, type BrowseQuery } from './browse-query';

import type { BrowsePage } from '@repo/db/store';

export type BrowseMeta = Omit<BrowsePage, 'products'>;
type Cards = BrowsePage['products'];
interface Snapshot {
  href: string;
  /** D-157: a state's page draws three types at one address; a snapshot is only its own type's. */
  type?: ProductType;
  query: BrowseQuery;
  meta: BrowseMeta;
  products: Cards;
  scrollY: number;
}

function metaOf(page: BrowsePage): BrowseMeta {
  const meta: Partial<BrowsePage> = { ...page };
  delete meta.products;
  return meta as BrowseMeta;
}
const here = (): string => window.location.pathname + window.location.search;
const KEY = 'iwc-browse';
const store = (id: string): string => `${KEY}:${id}`;

function readSnapshot(type: ProductType): Snapshot | null {
  try {
    const id = (window.history.state as Record<string, unknown> | null)?.[KEY];
    if (typeof id !== 'string') return null;
    const snap = JSON.parse(sessionStorage.getItem(store(id)) ?? 'null') as Snapshot | null;
    return snap && snap.href === here() && (snap.type ?? type) === type ? snap : null;
  } catch {
    return null;
  }
}

/**
 * The address's filters, inside the 7-day store when the page is one of its own (D-154), or within the state when the
 * page is the state's (D-157: the state is the page's, never the address's).
 */
function addressQuery(initial: BrowseQuery): BrowseQuery {
  const q = parseBrowseQuery(new URLSearchParams(window.location.search));
  if (initial.inState) return inStatePage(q, initial.inState);
  return initial.inQuick ? inQuickStore(q) : q;
}

/** D-157: on a state's page, whether the address is this type's (?type=, none for Clothing). */
function addressIsType(initial: BrowseQuery, productType: ProductType): boolean {
  if (!initial.inState) return true;
  const type = new URLSearchParams(window.location.search).get('type');
  return productType === 'clothing' ? !type || type === 'clothing' : type === PRODUCT_TYPE_PATH[productType].slice(1);
}

interface Entry {
  id: string;
  href: string;
}

/** Marks a history entry with a fresh id, for its snapshot (Next keeps its own state beside ours). */
function tagEntry(href: string | null, push: boolean): Entry {
  const id = Math.random().toString(36).slice(2, 10);
  const state = { ...((window.history.state as object | null) ?? {}), [KEY]: id };
  if (push && href) window.history.pushState(state, '', href);
  else window.history.replaceState(state, '', href ?? undefined);
  return { id, href: here() };
}
const entryOf = (snap: Snapshot): Entry => ({ id: (window.history.state as Record<string, string>)[KEY] ?? '', href: snap.href });

/**
 * See all's results without page loads (D-136): a filter fetches only the cards and counts (/api/browse) and puts
 * the filters in the address (pushState, so Back steps through them); Show more appends the next 24 where they are.
 * Each history entry keeps a snapshot in sessionStorage (cards, counts, scroll), so coming back from a product puts
 * the reader exactly where they were, cards and all. Any failed read falls back to an ordinary page load.
 */
export function useBrowse(productType: ProductType, initialQuery: BrowseQuery, initial: BrowsePage) {
  const [query, setQuery] = useState(initialQuery);
  const [meta, setMeta] = useState(() => metaOf(initial));
  const [products, setProducts] = useState(initial.products);
  const [loading, setLoading] = useState<false | 'replace' | 'append'>(false);
  const abort = useRef<AbortController | null>(null);
  const entry = useRef<Entry | null>(null);
  const scrollY = useRef(0);
  // A snapshot being drawn: its cards and where to scroll once they are on screen. Nothing is saved meanwhile (the
  // first render's 24 cards would overwrite it; React's development double mount does exactly that).
  const restoreTo = useRef<{ y: number; products: Cards } | null>(null);
  const settled = useRef(false);
  const saveRef = useRef<(y: number) => void>(() => undefined);

  const load = useCallback(
    async (q: BrowseQuery, offset: number, limit: number): Promise<BrowsePage | null> => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const search = browseSearch({ ...q, show: undefined });
      const url = `/api/browse?type=${productType}&offset=${offset}&limit=${limit}${search ? `&${search}` : ''}`;
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as BrowsePage;
      } catch (error) {
        if (ctrl.signal.aborted) return null;
        window.location.assign(browseHref(productType, { ...q, show: offset + limit > PAGE ? offset + limit : undefined }));
        throw error;
      } finally {
        if (abort.current === ctrl) setLoading(false);
      }
    },
    [productType],
  );

  const replace = useCallback(
    async (q: BrowseQuery): Promise<void> => {
      setQuery(q);
      setLoading('replace');
      const page = await load(q, 0, q.show ?? PAGE).catch(() => null);
      if (!page) return;
      setMeta(metaOf(page));
      setProducts(page.products);
    },
    [load],
  );

  /** A filter chosen: the address first (instant), then the cards. */
  const apply = useCallback(
    (q: BrowseQuery): void => {
      entry.current = tagEntry(browseHref(productType, q), true);
      void replace(q);
    },
    [productType, replace],
  );

  const showMore = useCallback(async (): Promise<void> => {
    setLoading('append');
    const page = await load(query, products.length, PAGE).catch(() => null);
    if (!page) return;
    // D-144: each page brings the next drawer of finishing touches, after the ones already drawn
    setMeta((prev) => {
      const seen = new Set(prev.drawer.map((p) => p.id));
      return { ...metaOf(page), drawer: [...prev.drawer, ...page.drawer.filter((p) => !seen.has(p.id))] };
    });
    setProducts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const next = [...prev, ...page.products.filter((p) => !seen.has(p.id))];
      // the address keeps how many are drawn (a reload or a shared link draws as many), without a new Back step
      window.history.replaceState(window.history.state, '', browseHref(productType, { ...query, show: next.length }));
      if (entry.current) entry.current = { ...entry.current, href: here() };
      return next;
    });
  }, [load, productType, products.length, query]);

  // On arrival: a snapshot of this entry (Back from a product) wins; else filters only the address has (the cached
  // page knows the state and category only) are read now.
  useLayoutEffect(() => {
    // D-157: a state's page draws its first type before it reads the address's: that view leaves the entry alone
    if (!addressIsType(initialQuery, productType)) return;
    const snap = readSnapshot(productType);
    if (snap) {
      entry.current = entryOf(snap);
      setQuery(snap.query);
      setMeta(snap.meta);
      setProducts(snap.products);
      restoreTo.current = { y: snap.scrollY, products: snap.products };
      return;
    }
    settled.current = true;
    entry.current = tagEntry(null, false);
    const fromUrl = addressQuery(initialQuery);
    if (!sameQuery(fromUrl, initialQuery)) void replace(fromUrl);
    // once, on arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back / Forward between filter sets on this page: Next keeps the page mounted, so read the entry here.
  useEffect(() => {
    const onPop = (): void => {
      // D-157: Back to another type's entry on a state's page: the page's switch shows that type instead
      if (!addressIsType(initialQuery, productType)) return;
      saveRef.current(scrollY.current); // the entry being left
      const snap = readSnapshot(productType);
      if (snap) {
        entry.current = entryOf(snap);
        setQuery(snap.query);
        setMeta(snap.meta);
        setProducts(snap.products);
        settled.current = false;
        restoreTo.current = { y: snap.scrollY, products: snap.products };
      } else {
        entry.current = tagEntry(null, false);
        void replace(addressQuery(initialQuery));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [replace, initialQuery, productType]);

  // The scroll position, kept in a ref while reading (cheap) and written with the snapshot on the way out.
  useEffect(() => {
    const onScroll = (): void => {
      scrollY.current = window.scrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const save = useCallback(
    (y: number): void => {
      if (!entry.current || !settled.current) return;
      try {
        const snap: Snapshot = { href: entry.current.href, type: productType, query, meta, products, scrollY: y };
        sessionStorage.setItem(store(entry.current.id), JSON.stringify(snap));
      } catch {
        // storage full or blocked: Back simply reloads the first page
      }
    },
    [meta, products, query, productType],
  );

  useEffect(() => {
    if (!loading) save(scrollY.current);
  }, [loading, save]);

  // Leaving the page (a product, another page): a layout cleanup runs before the next page scrolls to its top.
  saveRef.current = save;
  useLayoutEffect(() => () => saveRef.current(scrollY.current), []);

  // Once a snapshot's cards are drawn, back to where the reader was.
  useEffect(() => {
    const target = restoreTo.current;
    if (!target || target.products !== products) return;
    restoreTo.current = null;
    requestAnimationFrame(() => {
      window.scrollTo(0, target.y);
      scrollY.current = target.y;
      settled.current = true;
    });
  }, [products]);

  return { query, meta, products, loading, apply, showMore };
}

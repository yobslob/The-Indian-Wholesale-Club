'use client';

import { useRef, useState } from 'react';

import { MOST, PAGE } from '@/features/catalog/browse-query';
import { ProductCard } from '@/features/catalog/product-card';

import type { QuickPage } from '@repo/db/store';

const pill =
  'font-ui hover:border-ink inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-5 text-sm font-medium transition-colors';
/** A pill, filled when chosen (one background class each, so neither has to win in the stylesheet). */
const pillOf = (chosen: boolean): string =>
  `${pill} ${chosen ? 'bg-ink text-canvas border-ink' : 'bg-paper border-line'}`;

/**
 * The 7-day page's pills (All and each category, biggest first) and its cards (D-148). A pill or Show more swaps only
 * the cards, from /api/seven-day (the same cached read as the page); the page around them stays.
 */
export function QuickView({ initial }: { initial: QuickPage }): React.JSX.Element {
  const [category, setCategory] = useState<string | null>(null);
  const [products, setProducts] = useState(initial.products);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState<'replace' | 'append' | null>(null);
  const asked = useRef(0);

  async function load(next: string | null, offset: number): Promise<void> {
    const ask = ++asked.current;
    setLoading(offset === 0 ? 'replace' : 'append');
    const params = new URLSearchParams({ offset: String(offset), limit: String(PAGE) });
    if (next) params.set('category', next);
    try {
      const res = await fetch(`/api/seven-day?${params.toString()}`);
      if (!res.ok || ask !== asked.current) return;
      const page = (await res.json()) as QuickPage;
      setProducts((had) => (offset === 0 ? page.products : [...had, ...page.products]));
      setTotal(page.total);
    } catch {
      // the cards stay as they were; a later tap tries again
    } finally {
      if (ask === asked.current) setLoading(null);
    }
  }

  const choose = (next: string | null): void => {
    if (next === category) return;
    setCategory(next);
    void load(next, 0);
  };

  return (
    <div className="space-y-7">
      <nav aria-label="Categories" className="-mx-[var(--gut)] overflow-x-auto px-[var(--gut)] pb-1">
        <div className="flex gap-2">
          <button type="button" className={pillOf(category === null)} aria-pressed={category === null}
            onClick={() => choose(null)}>
            All <span className="opacity-60">{initial.all_total}</span>
          </button>
          {initial.categories.map((c) => (
            <button key={c.slug} type="button" className={pillOf(category === c.slug)}
              aria-pressed={category === c.slug} onClick={() => choose(c.slug)}>
              {c.name} <span className="opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      </nav>
      <div
        aria-busy={loading === 'replace'}
        className={`drift grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] transition-opacity duration-200 xl:grid-cols-4 ${
          loading === 'replace' ? 'opacity-50' : ''
        }`}
      >
        {products.map((p) => (
          // every card here is a 7-day piece: the page says so once, not on each card
          <ProductCard key={p.id} product={{ ...p, quick_days: null }} layout="grid" />
        ))}
      </div>
      {products.length < total && products.length < MOST && loading !== 'replace' ? (
        <div className="flex flex-col items-center gap-3 pt-4">
          <p className="text-ink-muted text-sm">
            Showing {products.length} of {total}
          </p>
          <button type="button" className={pillOf(false)} disabled={loading === 'append'}
            onClick={() => void load(category, products.length)}>
            {loading === 'append' ? 'Loading…' : 'Show more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useRef } from 'react';

import { browseHref, MOST, priceLabel, SORTS, WHO_LABEL, withFilter, type BrowseQuery } from './browse-query';
import { FilterPanel } from './filter-panel';
import styles from './filters.module.css';
import { PhoneFilter } from './phone-filter';
import { ProductCard } from './product-card';
import { useBrowse } from './use-browse';
import { WhoTiles } from './who-tiles';

import type { BrowsePage, BrowseSort } from '@repo/db/store';
import type { ProductType } from '@repo/shared/domain';

const pill =
  'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-6 text-sm font-medium transition-colors disabled:opacity-60';
const pieces = (n: number): string => `${n} ${n === 1 ? 'piece' : 'pieces'}`;

/**
 * A See all page's heading, filters and cards (D-136): the filter panel on the left from 1024 px (the Filter bar and
 * side panel below that), what is chosen as chips with ×, the sort, the grid and Show more. Choosing anything swaps
 * only the cards (use-browse.ts); the page around them stays as it is.
 */
export function BrowseView({
  productType,
  title,
  initialQuery,
  initial,
}: {
  productType: ProductType;
  title: string;
  initialQuery: BrowseQuery;
  initial: BrowsePage;
}): React.JSX.Element {
  const { query, meta, products, loading, apply, showMore } = useBrowse(productType, initialQuery, initial);
  const results = useRef<HTMLDivElement>(null);

  const stateName = meta.regions.find((s) => s.slug === query.state)?.name;
  const categoryName = meta.categories.find((c) => c.slug === query.category)?.name;
  const price = priceLabel(query);
  const whoName = query.who ? WHO_LABEL[query.who] : undefined;
  const chosen = Boolean(query.state || query.category || price || query.sizes.length || query.who);

  /** A filter applied: the cards swap in place; if the reader is far down, back to the top of the cards. */
  const change = (next: BrowseQuery): void => {
    apply(next);
    const top = results.current?.getBoundingClientRect().top ?? 0;
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 56;
    if (top < header) window.scrollTo({ top: window.scrollY + top - header - 16, behavior: 'smooth' });
  };
  const chip = (label: string, change_: Partial<BrowseQuery>) => {
    const next = withFilter(query, change_);
    return (
      <a
        key={label}
        href={browseHref(productType, next)}
        className={styles.chip}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          change(next);
        }}
      >
        {label}
        <b aria-hidden="true">×</b>
        <span className="sr-only">(remove)</span>
      </a>
    );
  };
  const clearAll = withFilter(query, { state: undefined, category: undefined, who: undefined, min: undefined, max: undefined, sizes: [] });
  const panel = <FilterPanel productType={productType} query={query} meta={meta} onChange={change} />;

  return (
    <>
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
        {categoryName ?? title}
        {whoName ? <span className="text-ink-muted"> · {whoName}</span> : null}
        {stateName ? <span className="text-ink-muted"> · {stateName}</span> : null}
      </h1>
      {productType === 'clothing' && meta.wears ? <WhoTiles query={query} counts={meta.wears} onChange={change} /> : null}
      <PhoneFilter
        chosen={`${whoName ? `${whoName} · ` : ''}${stateName ?? 'All states'} · ${categoryName ?? 'Everything'}${price ? ` · ${price}` : ''}`}
        count={pieces(meta.total)}
        onClear={chosen ? () => change(clearAll) : null}
      >
        {panel}
      </PhoneFilter>
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-[clamp(28px,3vw,52px)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div
            data-lenis-prevent
            className="no-scrollbar sticky top-[calc(var(--top-h)+20px)] max-h-[calc(100dvh-var(--top-h)-40px)] overflow-y-auto pb-6 pr-1"
          >
            {panel}
          </div>
        </aside>
        <div ref={results} className="min-w-0 scroll-mt-24">
          <div className="mb-[clamp(18px,2vw,28px)] flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="font-ui text-ink-muted m-0 hidden text-sm lg:block" aria-live="polite">
              {loading === 'replace' ? 'Finding pieces…' : pieces(meta.total)}
            </p>
            {chosen ? (
              <div className={`${styles.chips} order-last w-full md:order-none md:w-auto`}>
                {whoName ? chip(whoName, { who: undefined }) : null}
                {categoryName ? chip(categoryName, { category: undefined }) : null}
                {stateName ? chip(stateName, { state: undefined }) : null}
                {price ? chip(price, { min: undefined, max: undefined }) : null}
                {query.sizes.map((s) => chip(s, { sizes: query.sizes.filter((x) => x !== s) }))}
                <a
                  href={browseHref(productType, clearAll)}
                  className="font-ui text-ink-muted text-sm underline underline-offset-4"
                  onClick={(e) => {
                    e.preventDefault();
                    change(clearAll);
                  }}
                >
                  Clear all
                </a>
              </div>
            ) : null}
            <label className="font-ui ml-auto inline-flex items-center gap-2 text-sm">
              <span className="text-ink-muted">Sort by</span>
              <select
                value={query.sort}
                onChange={(e) => change(withFilter(query, { sort: e.target.value as BrowseSort }))}
                className="border-line bg-paper hover:border-ink min-h-10 rounded-pill border px-3 font-medium"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {products.length === 0 && !loading ? (
            <p className="text-ink-muted">
              Nothing matches all of these.{' '}
              {chosen ? (
                <button type="button" className="underline underline-offset-4" onClick={() => change(clearAll)}>
                  Clear the filters
                </button>
              ) : null}
            </p>
          ) : (
            <div
              aria-busy={loading === 'replace'}
              className={`drift drift-side grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] transition-opacity duration-200 lg:grid-cols-3 2xl:grid-cols-4 ${
                loading === 'replace' ? 'opacity-50' : ''
              }`}
            >
              {products.map((p) => (
                <ProductCard key={p.id} product={p} layout="side" />
              ))}
            </div>
          )}
          {products.length < meta.total && loading !== 'replace' ? (
            <div className="flex flex-col items-center gap-3 pt-10">
              <p className="text-ink-muted text-sm">
                Showing {products.length} of {meta.total}
              </p>
              {products.length < MOST ? (
                <a
                  href={browseHref(productType, { ...query, show: products.length + 24 })}
                  className={pill}
                  aria-disabled={loading === 'append'}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    if (!loading) void showMore();
                  }}
                >
                  {loading === 'append' ? 'Loading…' : 'Show more'}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

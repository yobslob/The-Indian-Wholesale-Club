import Link from 'next/link';

import { PRODUCT_TYPE_PATH } from '@repo/shared/domain';

import type { SearchIdeas } from './search-load';

const label = 'font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]';
const chip = 'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-[13px]';
const link = 'text-ink underline underline-offset-[3px]';
const count = (n: number): string => n.toLocaleString('en-US');

/** A row of links under a small heading, left out when there is nothing to offer. */
function Row({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }): React.JSX.Element | null {
  if (empty) return null;
  return (
    <div className="space-y-2.5">
      <p className={label}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * When a search finds nothing (launch QA D-3): popular searches, the states and the categories with the most pieces,
 * from store_search_hints() (the store's own words and counts, nothing made up).
 */
export function SearchIdeasRows({ ideas, base }: { ideas: SearchIdeas; base: string }): React.JSX.Element | null {
  const { regions, categories } = ideas;
  if (ideas.popular.length + regions.length + categories.length === 0) return null;
  return (
    <section className="space-y-5" aria-label="Ideas to search">
      <Row title="Popular searches" empty={ideas.popular.length === 0}>
        {ideas.popular.map((q) => (
          <Link key={q} href={`${base}?${new URLSearchParams({ q }).toString()}`} className={chip}>
            {q}
          </Link>
        ))}
      </Row>
      <Row title="States with the most pieces" empty={regions.length === 0}>
        {regions.map((r) => (
          <Link key={r.slug} href={`/states/${r.slug}`} className={chip}>
            {r.name} <span className="opacity-70">{count(r.count)}</span>
          </Link>
        ))}
      </Row>
      <Row title="Categories" empty={categories.length === 0}>
        {categories.map((c) => (
          <Link key={`${c.type}/${c.slug}`} href={`${PRODUCT_TYPE_PATH[c.type]}?category=${encodeURIComponent(c.slug)}`} className={chip}>
            {c.name} <span className="opacity-70">{count(c.count)}</span>
          </Link>
        ))}
      </Row>
    </section>
  );
}

/**
 * The line a search shows when the database was too slow or failed (launch QA D-1): no error page, a way to try
 * again (an address the CDN never keeps) and, for time, a shorter search.
 */
export function SearchBusy({ kind, retryHref }: { kind: 'busy' | 'error'; retryHref: string }): React.JSX.Element {
  return (
    <p className="text-ink-muted text-[15px]" role="status">
      {kind === 'busy'
        ? 'This search is taking longer than it should. Try a shorter search, or '
        : 'Search could not finish just now. '}
      <Link href={retryHref} className={link} prefetch={false}>
        {kind === 'busy' ? 'try again' : 'Try again'}
      </Link>
      .
    </p>
  );
}

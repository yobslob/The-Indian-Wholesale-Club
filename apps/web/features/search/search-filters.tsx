import Link from 'next/link';

import { PRODUCT_TYPE_LABEL, PRODUCT_TYPES, type ProductType } from '@repo/shared/domain';

import type { SearchPage, SearchSort } from '@repo/db/store';

/** The search page's own address with some of its filters changed (null removes one); Show more starts again. */
export type SearchHref = (over: Record<string, string | null>) => string;

const pill = 'font-ui inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors';
const on = 'bg-ink text-canvas border-ink';
const off = 'bg-paper border-line hover:border-ink';
const count = (n: number): string => n.toLocaleString('en-US');

const SORTS: { value: SearchSort | null; label: string }[] = [
  { value: null, label: 'Best match' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'new', label: 'Newest' },
];

/**
 * Search's filters (D-160), plain links so they work without JavaScript and each is its own address: the types with
 * their counts, the categories of what was found, a state the words name ("kerala saree": only Kerala's), and the
 * order. Each count comes from the same read as the cards (store_search_page).
 */
export function SearchFilters({
  page,
  type,
  category,
  state,
  sort,
  stateName,
  href,
}: {
  page: SearchPage;
  type: ProductType | null;
  category: string | null;
  state: string | null;
  sort: SearchSort | null;
  stateName: (slug: string) => string;
  href: SearchHref;
}): React.JSX.Element | null {
  const types = PRODUCT_TYPES.filter((t) => (page.types[t] ?? 0) > 0);
  const all = types.reduce((n, t) => n + (page.types[t] ?? 0), 0);
  // a state the words name, offered only when it narrows what was found
  const named = page.regions
    .filter((r) => page.named_regions.includes(r.slug) && r.slug !== state && r.count < page.total)
    .slice(0, 2);
  const showCats = page.categories.length > 1 || category !== null;
  if (page.all_total === 0) return null;
  return (
    <div className="space-y-3">
      <nav aria-label="Filter the results" className="flex flex-wrap items-center gap-2">
        {types.length > 1 || type ? (
          <>
            <Link href={href({ type: null, category: null })} aria-current={type ? undefined : 'true'} className={`${pill} ${type ? off : on}`}>
              All <span className="opacity-70">{count(all)}</span>
            </Link>
            {types.map((t) => (
              <Link
                key={t}
                href={href({ type: t, category: null })}
                aria-current={type === t ? 'true' : undefined}
                className={`${pill} ${type === t ? on : off}`}
              >
                {PRODUCT_TYPE_LABEL[t]} <span className="opacity-70">{count(page.types[t] ?? 0)}</span>
              </Link>
            ))}
          </>
        ) : null}
        {state ? (
          <Link href={href({ state: null })} className={`${pill} ${on}`} aria-label={`From ${stateName(state)}: remove`}>
            From {stateName(state)} <span aria-hidden="true">×</span>
          </Link>
        ) : null}
        {named.map((r) => (
          <Link key={r.slug} href={href({ state: r.slug })} className={`${pill} ${off}`}>
            Only from {r.name} <span className="opacity-70">{count(r.count)}</span>
          </Link>
        ))}
        <details className="relative ml-auto">
          <summary className={`${pill} ${off} cursor-pointer list-none`}>
            Sort: {SORTS.find((s) => s.value === sort)?.label ?? 'Best match'} <span aria-hidden="true">▾</span>
          </summary>
          <ul className="border-line bg-paper absolute right-0 z-20 mt-2 min-w-52 rounded-md border p-1 shadow-lg">
            {SORTS.map((s) => (
              <li key={s.label}>
                <Link
                  href={href({ sort: s.value })}
                  aria-current={s.value === sort ? 'true' : undefined}
                  className="font-ui hover:bg-canvas block rounded-sm px-3 py-2.5 text-sm aria-[current]:font-semibold"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </nav>
      {showCats ? (
        <nav aria-label="Categories" className="flex flex-wrap gap-2">
          {page.categories.slice(0, 8).map((c) => (
            <Link
              key={c.slug}
              href={href({ category: category === c.slug ? null : c.slug, type: c.type })}
              aria-current={category === c.slug ? 'true' : undefined}
              className={`font-ui inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3.5 text-[13px] ${category === c.slug ? on : off}`}
            >
              {c.name} <span className="opacity-70">{category === c.slug ? '×' : count(c.count)}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

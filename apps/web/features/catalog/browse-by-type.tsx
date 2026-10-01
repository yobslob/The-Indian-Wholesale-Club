import Link from 'next/link';
import { z } from 'zod';

import { listProductsCached } from './data';
import { ProductCard, ProductGrid } from './product-card';

const PAGE = 24;
const pill = (on: boolean): string =>
  `font-ui inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill border px-5 text-sm font-medium ${
    on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper hover:border-ink'
  }`;

export interface BrowseParams {
  state?: string;
  category?: string;
  show?: string;
}

type RawParams = Record<string, string | string[] | undefined>;
const slugParam = z.string().regex(/^[a-z0-9-]{1,80}$/).optional().catch(undefined);

/** The page's URL filters, checked (a slug or nothing, a number or nothing). */
export function browseParams(raw: RawParams): BrowseParams {
  return {
    state: slugParam.parse(raw.state),
    category: slugParam.parse(raw.category),
    show: z.string().regex(/^\d{1,4}$/).optional().catch(undefined).parse(raw.show),
  };
}

/**
 * /clothing and /spices, the "See all" pages behind every row (D-062): every live product of one type, newest
 * first, narrowed by state and category through the URL. One cached read; the filtering happens on the server
 * and only the first cards are drawn (24, then "Show more"), so a long list never lands on the page at once.
 */
export async function BrowseByType({
  productType,
  title,
  emptyText,
  params,
}: {
  productType: 'clothing' | 'spice';
  title: string;
  emptyText: string;
  params: BrowseParams;
}): Promise<React.JSX.Element> {
  const all = await listProductsCached({ productType, sort: 'newest', limit: 1000 });
  const base = productType === 'clothing' ? '/clothing' : '/spices';
  const inState = params.state ? all.filter((p) => p.region_slug === params.state) : all;
  const shown = params.category ? inState.filter((p) => p.category_slug === params.category) : inState;
  const count = Math.min(shown.length, Math.max(PAGE, Number(params.show) || PAGE));
  const href = (next: BrowseParams): string => {
    const query = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''),
    ).toString();
    return query ? `${base}?${query}` : base;
  };

  const states = [...new Map(all.map((p) => [p.region_slug, p.region_name])).entries()]
    .map(([slug, name]) => ({ slug, name, n: all.filter((p) => p.region_slug === slug).length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const categories = [...new Map(inState.map((p) => [p.category_slug, p.category_name])).entries()]
    .map(([slug, name]) => ({ slug, name, n: inState.filter((p) => p.category_slug === slug).length }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'en'));
  const stateName = states.find((s) => s.slug === params.state)?.name;
  const categoryName = categories.find((c) => c.slug === params.category)?.name;

  return (
    <div className="space-y-6">
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
        {categoryName ?? title}
        {stateName ? <span className="text-ink-muted"> · {stateName}</span> : null}
      </h1>
      {all.length === 0 ? (
        <p className="text-ink-muted">{emptyText}</p>
      ) : (
        <>
          <nav aria-label="Filter by state" className="no-scrollbar -mx-[var(--gut)] flex gap-2.5 overflow-x-auto px-[var(--gut)]">
            <Link href={href({ category: params.category })} aria-current={!params.state ? 'page' : undefined} className={pill(!params.state)}>
              All states <span className="opacity-60">{all.length}</span>
            </Link>
            {states.map((s) => (
              <Link key={s.slug} href={href({ state: s.slug })} aria-current={params.state === s.slug ? 'page' : undefined} className={pill(params.state === s.slug)}>
                {s.name} <span className="opacity-60">{s.n}</span>
              </Link>
            ))}
          </nav>
          {categories.length > 1 ? (
            <nav aria-label="Filter by category" className="no-scrollbar -mx-[var(--gut)] flex gap-2.5 overflow-x-auto px-[var(--gut)]">
              <Link href={href({ state: params.state })} aria-current={!params.category ? 'page' : undefined} className={pill(!params.category)}>
                Everything
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={href({ state: params.state, category: c.slug })}
                  aria-current={params.category === c.slug ? 'page' : undefined}
                  className={pill(params.category === c.slug)}
                >
                  {c.name} <span className="opacity-60">{c.n}</span>
                </Link>
              ))}
            </nav>
          ) : null}
          {shown.length === 0 ? (
            <p className="text-ink-muted">Nothing here yet.</p>
          ) : (
            <ProductGrid>
              {shown.slice(0, count).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          )}
          {count < shown.length ? (
            <div className="flex flex-col items-center gap-3 pt-4">
              <p className="text-ink-muted text-sm">
                Showing {count} of {shown.length}
              </p>
              <Link href={href({ ...params, show: String(count + PAGE) })} scroll={false} className={pill(false)}>
                Show more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

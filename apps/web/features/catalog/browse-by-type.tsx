import Link from 'next/link';
import { z } from 'zod';

import styles from './browse.module.css';
import { browseCached } from './data';
import { EdgeRow } from './edge-row';
import { PhoneFilter } from './phone-filter';
import { ProductCard, ProductGrid } from './product-card';

const PAGE = 24;
/** The most cards one page draws (20 pages of "Show more"; the database allows 500). */
const MOST = 480;
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
 * first, narrowed by state and category through the URL. One cached store_browse() read returns the cards drawn
 * (24, then "Show more", D-067), the total and the filter counts, so the page never loads the whole catalogue.
 * D-084: the state row pins under the header and the category row scrolls away, both with soft ends (D-098); phones
 * get one Filter bar and a side panel instead of the two rows.
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
  const limit = Math.min(MOST, Math.max(PAGE, Number(params.show) || PAGE));
  const page = await browseCached({
    productType,
    regionSlug: params.state,
    categorySlug: params.category,
    limit,
  });
  const base = productType === 'clothing' ? '/clothing' : '/spices';
  const states = page.regions;
  const categories = page.categories;
  const allCount = states.reduce((sum, s) => sum + s.count, 0);
  const shown = page.products;
  const count = shown.length;
  const href = (next: BrowseParams): string => {
    const query = new URLSearchParams(
      Object.entries(next).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== ''),
    ).toString();
    return query ? `${base}?${query}` : base;
  };

  const stateName = states.find((s) => s.slug === params.state)?.name;
  const categoryName = categories.find((c) => c.slug === params.category)?.name;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
        {categoryName ?? title}
        {stateName ? <span className="text-ink-muted"> · {stateName}</span> : null}
      </h1>
      {allCount === 0 ? (
        <p className="text-ink-muted">{emptyText}</p>
      ) : (
        <>
          <div className={`${styles.pin} hidden md:block`}>
            <EdgeRow label="Filter by state">
              <Link href={href({ category: params.category })} aria-current={!params.state ? 'page' : undefined} className={pill(!params.state)}>
                All states <span className="opacity-60">{allCount}</span>
              </Link>
              {states.map((s) => (
                <Link key={s.slug} href={href({ state: s.slug })} aria-current={params.state === s.slug ? 'page' : undefined} className={pill(params.state === s.slug)}>
                  {s.name} <span className="opacity-60">{s.count}</span>
                </Link>
              ))}
            </EdgeRow>
          </div>
          {categories.length > 1 ? (
            <div className="hidden md:block">
              <EdgeRow label="Filter by category" blur>
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
                    {c.name} <span className="opacity-60">{c.count}</span>
                  </Link>
                ))}
              </EdgeRow>
            </div>
          ) : null}
          <PhoneFilter
            chosen={`${stateName ?? 'All states'} · ${categoryName ?? 'Everything'}`}
            count={`${page.total} ${page.total === 1 ? 'piece' : 'pieces'}`}
            clearHref={params.state || params.category ? base : null}
          >
            <h3 className={styles.group}>State</h3>
            <ul className={styles.list}>
              {[{ slug: undefined, name: 'All states', count: allCount }, ...states].map((s) => (
                <li key={s.slug ?? 'all'}>
                  <Link href={s.slug ? href({ state: s.slug }) : href({ category: params.category })} aria-current={params.state === s.slug ? 'page' : undefined}>
                    <i aria-hidden="true">{params.state === s.slug ? '✓' : ''}</i>
                    {s.name}
                    <span>{s.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {categories.length > 1 ? (
              <>
                <h3 className={styles.group}>Category</h3>
                <ul className={styles.list}>
                  {[{ slug: undefined, name: 'Everything', count: undefined }, ...categories].map((c) => (
                    <li key={c.slug ?? 'all'}>
                      <Link href={href({ state: params.state, category: c.slug })} aria-current={params.category === c.slug ? 'page' : undefined}>
                        <i aria-hidden="true">{params.category === c.slug ? '✓' : ''}</i>
                        {c.name}
                        {c.count !== undefined ? <span>{c.count}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </PhoneFilter>
          {shown.length === 0 ? (
            <p className="text-ink-muted">Nothing here yet.</p>
          ) : (
            <ProductGrid>
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          )}
          {count < page.total ? (
            <div className="flex flex-col items-center gap-3 pt-4">
              <p className="text-ink-muted text-sm">
                Showing {count} of {page.total}
              </p>
              {count < MOST ? (
                <Link href={href({ ...params, show: String(count + PAGE) })} scroll={false} className={pill(false)}>
                  Show more
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

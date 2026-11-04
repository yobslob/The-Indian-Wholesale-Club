import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getHomeCached } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { ProductRow } from '@/features/catalog/product-row';
import { StampGrid } from '@/features/regions/region-stamp';
import { isLimitedLocal } from '@/lib/rate-limit';

import { SearchField } from './search-field';
import { SearchFilters, type SearchHref } from './search-filters';
import { SearchBusy, SearchIdeasRows } from './search-ideas';
import { EMPTY_PAGE, loadSearch, loadSearchIdeas, type SearchResult } from './search-load';
import { asCame, PAGE, readSearch, searchHref, withFilters, type SearchParams } from './search-url';

export type { SearchParams } from './search-url';

const h2 = 'font-heading text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em] text-[#1D1A17]';
const label = 'font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]';
const link = 'text-ink underline underline-offset-[3px]';
const plural = (n: number, word: string, more = false): string =>
  `${n.toLocaleString('en-US')}${more ? '+' : ''} ${word}${n === 1 && !more ? '' : 's'}`;

/**
 * Search (/search): products and regions in one round trip
 * (store_search_page, D-160: stems, synonyms, spelling fixes, "some of your words", the counts). No session.
 * Results come 24 at a time with "Show more" (?show=). D-085: the count with the words under the box; matching
 * states as the D-080 stamps; with no words, the open states and Just listed, so the page is never a dead end. D-160:
 * the type, category and state filters and Sort by as links; "Showing results for" a fixed spelling.
 * Launch QA: every search has one address (search-url.ts: lower case, its parameters in one order, nothing else), so
 * the CDN can keep a page for everyone (D-2); the page holds nothing about the visitor (a caller searching faster
 * than a person is sent to the Try again address, which is never kept); a slow or failing database shows a line with
 * Try again, never the error page (D-1); a search that finds nothing offers popular searches, states and categories
 * (D-3).
 */
const base = '/search';

export async function SearchView({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const params = await searchParams;
  const s = readSearch(params);
  const own = searchHref(base, s);
  if (own !== asCame(base, params)) redirect(own);
  const { q, type, category, state, sort, show } = s;
  const retryHref = searchHref(base, { ...s, retry: true });
  const limited = q ? isLimitedLocal(await headers(), 'search') : false;
  if (limited && !s.retry) redirect(retryHref);
  const home = await getHomeCached();
  const filtered = Boolean(type || category || state || sort);
  // "Show more" and the filters read from the first result again, so only the first unfiltered page is recorded
  const filter = {
    type: type ?? undefined,
    category: category ?? undefined,
    region: state ?? undefined,
    sort: sort ?? undefined,
    limit: show,
    record: show === PAGE && !filtered,
  };
  const { page, failed }: SearchResult = q && !limited ? await loadSearch(q, filter) : { page: EMPTY_PAGE, failed: null };
  const products = page.products;
  const more = page.total > products.length;
  const regions =
    q ? home.regions.filter((r) => page.named_regions.includes(r.slug) || r.name.toLowerCase().includes(q)) : [];
  const open = regions.filter((r) => r.is_live);
  const soon = regions.filter((r) => !r.is_live);
  const found = page.mode !== 'none' && page.mode !== 'some';
  const nothing = !q || (!found && regions.length === 0);
  const ideas = q && !limited && !failed && !found && regions.length === 0 ? await loadSearchIdeas() : null;
  const href: SearchHref = (over) => searchHref(base, withFilters(s, over));
  const stateName = (slug: string): string => home.regions.find((r) => r.slug === slug)?.name ?? slug;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
          Search
        </h1>
        <form action={base} className="mt-6 flex max-w-3xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <SearchField defaultValue={q} placeholder="Search a state, a saree, a masala…" />
          <button type="submit" className="bg-brand text-on-brand font-ui hidden min-h-12 rounded-pill px-6 text-[15px] font-medium md:block">
            Search
          </button>
        </form>
        {q ? (
          <div className="text-ink-muted mt-3.5 space-y-1 text-[15px]" role="status">
            {limited ? <p>Searching a little fast: wait a moment, then search again.</p> : null}
            {page.mode === 'fixed' && page.fixed ? (
              <p>
                No pieces match “{q}”. Showing pieces for <b className="text-ink font-medium">“{page.fixed}”</b>.
              </p>
            ) : null}
            {!limited && !failed ? (
              <p>
                {regions.length > 0 ? <b className="text-ink font-medium">{plural(regions.length, 'state')}</b> : null}
                {regions.length > 0 && found ? ' and ' : null}
                {found || regions.length === 0 ? (
                  <b className="text-ink font-medium">{plural(found ? page.total : 0, 'piece', found && page.capped)}</b>
                ) : null}
                {` for “${page.fixed ?? q}”`}
              </p>
            ) : null}
          </div>
        ) : null}
        {failed ? (
          <div className="mt-3.5">
            <SearchBusy kind={failed} retryHref={retryHref} />
          </div>
        ) : null}
      </div>

      {found ? (
        <SearchFilters page={page} type={type} category={category} state={state} sort={sort} stateName={stateName} href={href} />
      ) : null}

      {regions.length > 0 ? (
        <section className="space-y-4">
          <h2 className={h2}>States</h2>
          {open.length > 0 ? (
            <div className="max-w-[660px]">
              <StampGrid regions={open} />
            </div>
          ) : null}
          {soon.length > 0 ? (
            <p className="font-ui text-ink-muted m-0 text-sm">
              Coming soon:{' '}
              {soon.map((r, i) => (
                <span key={r.slug}>
                  {i > 0 ? ', ' : null}
                  <Link href={`/states/${r.slug}`} className={link}>
                    {r.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ) : null}

      {q && !limited && !failed && (products.length > 0 || regions.length === 0) ? (
        <section className="space-y-4">
          <h2 className={h2}>Products</h2>
          {!found ? (
            <p className="text-ink-muted text-[15px]">
              {`No products match “${q}”. `}
              {page.mode === 'some' ? 'These have some of its words. ' : null}
            </p>
          ) : null}
          {found && page.total === 0 ? (
            <p className="text-ink-muted text-[15px]">
              None with these filters. <Link href={href({ type: null, category: null, state: null })} className={link}>Show every match</Link>
            </p>
          ) : null}
          {products.length > 0 ? (
            <ProductGrid>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          ) : null}
          {more ? (
            <Link
              href={searchHref(base, { ...s, retry: false, show: show + PAGE })}
              scroll={false}
              className="border-line bg-paper hover:border-ink font-ui inline-flex min-h-12 items-center rounded-pill border px-6 text-[15px]"
            >
              Show more
            </Link>
          ) : null}
        </section>
      ) : null}

      {ideas ? <SearchIdeasRows ideas={ideas} base={base} /> : null}

      {nothing ? (
        <>
          {!q && home.regions.some((r) => r.is_live) ? (
            <section className="space-y-3">
              <p className={label}>Open now</p>
              <div className="max-w-[660px]">
                <StampGrid regions={home.regions.filter((r) => r.is_live)} />
              </div>
            </section>
          ) : null}
          <ProductRow id="just-listed" title="Just listed" products={home.just_listed_types.clothing ?? []} href="/clothing" />
        </>
      ) : null}
    </div>
  );
}

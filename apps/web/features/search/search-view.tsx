import { headers } from 'next/headers';
import Link from 'next/link';

import { SEARCH_SORTS, type SearchPage, type SearchSort } from '@repo/db/store';
import { isProductType, type ProductType } from '@repo/shared/domain';
import { cleanSearch } from '@repo/shared/search';

import { getHomeCached, getStorePolicyCached, searchStorePage } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { ProductRow } from '@/features/catalog/product-row';
import { postmarkFor, StampGrid } from '@/features/regions/region-stamp';
import { isLimitedLocal } from '@/lib/rate-limit';
import { QUICK_HOME } from '@/lib/site';

import { SearchField } from './search-field';
import { SearchFilters } from './search-filters';

type Param = string | string[] | undefined;
export type SearchParams = Promise<Record<'q' | 'show' | 'delivery' | 'type' | 'category' | 'state' | 'sort', Param>>;

const PAGE = 24;
/** D-154: the IWC store's "Delivery: in 7 days", as the address carries it (?delivery=7-day). */
const QUICK_VALUE = '7-day';
const h2 = 'font-heading text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em] text-[#1D1A17]';
const label = 'font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]';
const pill = 'font-ui inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors';
const link = 'text-ink underline underline-offset-[3px]';
const plural = (n: number, word: string): string => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
const first = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : v);
const slug = (v: Param): string | null => {
  const s = first(v);
  return s && /^[a-z0-9-]{1,60}$/.test(s) ? s : null;
};

const EMPTY: SearchPage = {
  query: '',
  fixed: null,
  mode: 'none',
  total: 0,
  all_total: 0,
  types: {},
  categories: [],
  regions: [],
  named_regions: [],
  products: [],
};

/**
 * Search (/search, and since D-154 the 7-day store's /7-day-delivery/search): products and regions in one round trip
 * (store_search_page, D-160: stems, synonyms, spelling fixes, "some of your words", the counts). No session.
 * Results come 24 at a time with "Show more" (?show=). D-085: the count with the words under the box; matching
 * states as the D-080 stamps; with no words or no results, the open states and Just listed, so the page is never a
 * dead end. D-160: the type, category and state filters and Sort by as links (?type= ?category= ?state= ?sort=);
 * "Showing results for" a fixed spelling. D-154: in the IWC store "Delivery: in 7 days" keeps only 7-day pieces; the
 * 7-day store's search finds only those, without the states. A caller searching faster than a person is told to wait.
 */
export async function SearchView({ searchParams, store }: { searchParams: SearchParams; store: 'iwc' | 'quick' }): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = cleanSearch(first(params.q) ?? '');
  const showRaw = Number(first(params.show));
  const show = Math.min(Math.max(Number.isInteger(showRaw) ? showRaw : PAGE, PAGE), 480);
  const typeRaw = first(params.type);
  const type: ProductType | null = isProductType(typeRaw) ? typeRaw : null;
  const category = slug(params.category);
  const sortRaw = first(params.sort);
  const sort = (SEARCH_SORTS as readonly string[]).includes(sortRaw ?? '') ? (sortRaw as SearchSort) : null;
  const inQuick = store === 'quick';
  const state = inQuick ? null : slug(params.state);
  const [home, policy] = await Promise.all([getHomeCached(), getStorePolicyCached()]);
  const quickOn = policy.quick_delivery_on;
  const quick = inQuick || (quickOn && first(params.delivery) === QUICK_VALUE);
  const base = inQuick ? `${QUICK_HOME}/search` : '/search';
  const limited = q ? isLimitedLocal(await headers(), 'search') : false;
  const filtered = Boolean(type || category || state || sort);
  // "Show more" and the filters read from the first result again, so only the first unfiltered page is recorded
  const filter = {
    type: type ?? undefined,
    category: category ?? undefined,
    region: state ?? undefined,
    sort: sort ?? undefined,
    limit: show,
    record: show === PAGE && !filtered,
    quick,
  };
  const page = q && !limited ? await searchStorePage(q, filter) : EMPTY;
  const products = page.products;
  const more = page.total > products.length;
  const needle = q.toLowerCase();
  const regions =
    q && !quick ? home.regions.filter((r) => page.named_regions.includes(r.slug) || r.name.toLowerCase().includes(needle)) : [];
  const open = regions.filter((r) => r.is_live);
  const soon = regions.filter((r) => !r.is_live);
  const postmark = postmarkFor(home.delivery);
  const found = page.mode !== 'none' && page.mode !== 'some';
  const nothing = !q || (!found && regions.length === 0);
  const current: Record<string, string | null> = { q, delivery: quick && !inQuick ? QUICK_VALUE : null, type, category, state, sort };
  const href = (over: Record<string, string | null>): string => {
    const all = { ...current, ...over };
    const qs = new URLSearchParams(Object.entries(all).filter((e): e is [string, string] => e[1] !== null));
    return `${base}?${qs.toString()}`;
  };
  const filterHref = `/search?${new URLSearchParams({ q, ...(quick ? {} : { delivery: QUICK_VALUE }) }).toString()}`;
  const stateName = (s: string): string => home.regions.find((r) => r.slug === s)?.name ?? s;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">
          {inQuick ? 'Search the 7-day store' : 'Search'}
        </h1>
        <form action={base} className="mt-6 flex max-w-3xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          {quick && !inQuick ? <input type="hidden" name="delivery" value={QUICK_VALUE} /> : null}
          <SearchField
            defaultValue={q}
            quick={quick}
            placeholder={inQuick ? 'Search snacks, masalas, sweets…' : 'Search a state, a saree, a masala…'}
          />
          <button type="submit" className="bg-brand text-on-brand font-ui hidden min-h-12 rounded-pill px-6 text-[15px] font-medium md:block">
            Search
          </button>
        </form>
        {q && quickOn && !inQuick ? (
          <div className="mt-4">
            <Link href={filterHref} aria-pressed={quick} className={`${pill} ${quick ? 'bg-ink text-canvas border-ink' : 'bg-paper border-line hover:border-ink'}`}>
              Delivery: in {policy.quick_delivery_days_max} days
              {quick ? <span aria-hidden="true">×</span> : null}
            </Link>
          </div>
        ) : null}
        {q ? (
          <div className="text-ink-muted mt-3.5 space-y-1 text-[15px]" role="status">
            {limited ? <p>Searching a little fast: wait a moment, then search again.</p> : null}
            {page.mode === 'fixed' && page.fixed ? (
              <p>
                No pieces match “{q}”. Showing pieces for <b className="text-ink font-medium">“{page.fixed}”</b>.
              </p>
            ) : null}
            {!limited ? (
              <p>
                {regions.length > 0 ? <b className="text-ink font-medium">{plural(regions.length, 'state')}</b> : null}
                {regions.length > 0 && found ? ' and ' : null}
                {found || regions.length === 0 ? <b className="text-ink font-medium">{plural(found ? page.total : 0, 'piece')}</b> : null}
                {` for “${page.fixed ?? q}”`}
              </p>
            ) : null}
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
              <StampGrid regions={open} postmark={postmark} idPrefix="sr" />
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

      {q && !limited && (products.length > 0 || regions.length === 0) ? (
        <section className="space-y-4">
          <h2 className={h2}>Products</h2>
          {!found ? (
            <p className="text-ink-muted text-[15px]">
              {inQuick ? `Nothing in the 7-day store matches “${q}”. ` : `No products match “${q}”. `}
              {page.mode === 'some' ? 'These have some of its words. ' : null}
              {quick ? (
                <Link href={`/search?${new URLSearchParams({ q }).toString()}`} className={link}>
                  Search the whole IWC store
                </Link>
              ) : null}
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
              href={`${href({})}&show=${show + PAGE}`}
              scroll={false}
              className="border-line bg-paper hover:border-ink font-ui inline-flex min-h-12 items-center rounded-pill border px-6 text-[15px]"
            >
              Show more
            </Link>
          ) : null}
        </section>
      ) : null}

      {nothing && !inQuick ? (
        <>
          {home.regions.some((r) => r.is_live) ? (
            <section className="space-y-3">
              <p className={label}>Open now</p>
              <div className="max-w-[660px]">
                <StampGrid regions={home.regions.filter((r) => r.is_live)} postmark={postmark} idPrefix="so" />
              </div>
            </section>
          ) : null}
          <ProductRow id="just-listed" title="Just listed" products={home.just_listed} href="/clothing" />
        </>
      ) : null}
      {nothing && inQuick && !q ? (
        <p className="text-ink-muted text-[15px]">
          Or browse <Link href={QUICK_HOME} className={link}>the whole 7-day store</Link>.
        </p>
      ) : null}
    </div>
  );
}

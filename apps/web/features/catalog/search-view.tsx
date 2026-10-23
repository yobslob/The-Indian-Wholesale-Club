import Link from 'next/link';

import { getHomeCached, getStorePolicyCached, searchProducts } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { ProductRow } from '@/features/catalog/product-row';
import { postmarkFor, StampGrid } from '@/features/regions/region-stamp';
import { HeaderIcon } from '@/features/shell/header-icons';
import { QUICK_HOME } from '@/lib/site';

export type SearchParams = Promise<{ q?: string | string[]; show?: string | string[]; delivery?: string | string[] }>;

const PAGE = 24;
/** D-154: the IWC store's "Delivery: in 7 days", as the address carries it (?delivery=7-day). */
const QUICK_VALUE = '7-day';
const h2 = 'font-heading text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em] text-[#1D1A17]';
const label = 'font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]';
const pill = 'font-ui inline-flex min-h-10 items-center gap-2 rounded-pill border px-4 text-sm font-medium transition-colors';
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Search (/search, and since D-154 the 7-day store's /7-day-delivery/search): products (full-text, one round trip) and
 * regions (from the cached home data). No session. Results come 24 at a time with "Show more" (?show=), so a broad
 * search never puts hundreds of photos on one page. D-085: the count with the words under the box; matching open
 * states as the D-080 stamps; with no words or no results, the open states and Just listed, so the page is never a
 * dead end; on phones a round search icon inside the box. D-154: in the IWC store "Delivery: in 7 days" keeps only
 * 7-day pieces (while 7-day delivery is on); the 7-day store's search finds only those, without the states.
 */
export async function SearchView({
  searchParams,
  store,
}: {
  searchParams: SearchParams;
  store: 'iwc' | 'quick';
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) ?? '';
  const showRaw = Number(first(params.show));
  const show = Math.min(Math.max(Number.isInteger(showRaw) ? showRaw : PAGE, PAGE), 480);
  const [home, policy] = await Promise.all([getHomeCached(), getStorePolicyCached()]);
  const inQuick = store === 'quick';
  const quickOn = policy.quick_delivery_on;
  const quick = inQuick || (quickOn && first(params.delivery) === QUICK_VALUE);
  const base = inQuick ? `${QUICK_HOME}/search` : '/search';
  // One more than shown tells whether "Show more" has anything behind it. "Show more" reads from the first result
  // again, so only the first page records the search (Insights would count it once per click otherwise).
  const found = q ? await searchProducts(q, show + 1, show === PAGE, quick) : [];
  const products = found.slice(0, show);
  const more = found.length > show;
  const needle = q.toLowerCase();
  const regions = q && !quick ? home.regions.filter((r) => r.name.toLowerCase().includes(needle)) : [];
  const open = regions.filter((r) => r.is_live);
  const soon = regions.filter((r) => !r.is_live);
  const postmark = postmarkFor(home.delivery);
  const nothing = !q || (products.length === 0 && regions.length === 0);
  // The count only counts what the search returned: with more behind "Show more", it says so ("24+").
  const pieces = more ? `${products.length}+ pieces` : plural(products.length, 'piece');
  const href = (over: Record<string, string>): string =>
    `${base}?${new URLSearchParams({ q, ...(quick && !inQuick ? { delivery: QUICK_VALUE } : {}), ...over }).toString()}`;
  const filterHref = `/search?${new URLSearchParams({ q, ...(quick ? {} : { delivery: QUICK_VALUE }) }).toString()}`;

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
          <div className="relative flex flex-1">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder={inQuick ? 'Search snacks, masalas, sweets…' : 'Search a state, a saree, a masala…'}
              className="border-line bg-paper focus:border-ink min-h-12 flex-1 rounded-pill border px-4 pr-[52px] text-[15px] outline-none md:pr-4"
            />
            <button type="submit" aria-label="Search" className="bg-brand text-on-brand absolute right-1 top-1 grid size-10 place-items-center rounded-full md:hidden">
              <HeaderIcon name="search" />
            </button>
          </div>
          <button type="submit" className="bg-brand text-on-brand font-ui hidden min-h-12 rounded-pill px-6 text-[15px] font-medium md:block">
            Search
          </button>
        </form>
        {q && quickOn && !inQuick ? (
          <div className="mt-4">
            <Link
              href={filterHref}
              aria-pressed={quick}
              className={`${pill} ${quick ? 'bg-ink text-canvas border-ink' : 'bg-paper border-line hover:border-ink'}`}
            >
              Delivery: in {policy.quick_delivery_days_max} days
              {quick ? <span aria-hidden="true">×</span> : null}
            </Link>
          </div>
        ) : null}
        {q ? (
          <p className="text-ink-muted mt-3.5 text-[15px]" role="status">
            {regions.length > 0 ? <b className="text-ink font-medium">{plural(regions.length, 'state')}</b> : null}
            {regions.length > 0 && products.length > 0 ? ' and ' : null}
            {products.length > 0 || regions.length === 0 ? <b className="text-ink font-medium">{pieces}</b> : null} for “{q}”
          </p>
        ) : null}
      </div>

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
                  <Link href={`/states/${r.slug}`} className="text-ink underline underline-offset-[3px]">
                    {r.name}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </section>
      ) : null}

      {q && (products.length > 0 || regions.length === 0) ? (
        <section className="space-y-4">
          <h2 className={h2}>Products</h2>
          {products.length === 0 ? (
            <p className="text-ink-muted text-[15px]">
              {inQuick ? `Nothing in the 7-day store matches “${q}”. ` : `No products match “${q}”. `}
              {quick ? (
                <Link href={`/search?${new URLSearchParams({ q }).toString()}`} className="text-ink underline underline-offset-[3px]">
                  Search the whole IWC store
                </Link>
              ) : null}
            </p>
          ) : (
            <ProductGrid>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          )}
          {more ? (
            <Link
              href={href({ show: String(show + PAGE) })}
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
          Or browse <Link href={QUICK_HOME} className="text-ink underline underline-offset-[3px]">the whole 7-day store</Link>.
        </p>
      ) : null}
    </div>
  );
}

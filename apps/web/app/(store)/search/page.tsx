import Link from 'next/link';


import { getHomeCached, searchProducts } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { ProductRow } from '@/features/catalog/product-row';
import { postmarkFor, StampGrid } from '@/features/regions/region-stamp';
import { HeaderIcon } from '@/features/shell/header-icons';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

type SearchParams = Promise<{ q?: string | string[]; show?: string | string[] }>;

const PAGE = 24;
const h2 = 'font-heading text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em] text-[#1D1A17]';
const label = 'font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]';
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Products (full-text, one round trip) and regions (from the cached home data). No session. Results come 24 at a
 * time with "Show more" (?show=), so a broad search never puts hundreds of photos on one page. D-085: the count with
 * the words under the box; matching open states as the D-080 stamps; with no words or no results, the open states and
 * Just listed, so the page is never a dead end; on phones a round search icon inside the box.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const raw = params.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? '';
  const showRaw = Number(Array.isArray(params.show) ? params.show[0] : params.show);
  const show = Math.min(Math.max(Number.isInteger(showRaw) ? showRaw : PAGE, PAGE), 480);
  // One more than shown tells whether "Show more" has anything behind it. "Show more" reads from the first result
  // again, so only the first page records the search (Insights would count it once per click otherwise).
  const [home, found] = await Promise.all([getHomeCached(), q ? searchProducts(q, show + 1, show === PAGE) : []]);
  const products = found.slice(0, show);
  const more = found.length > show;
  const needle = q.toLowerCase();
  const regions = q ? home.regions.filter((r) => r.name.toLowerCase().includes(needle)) : [];
  const open = regions.filter((r) => r.is_live);
  const soon = regions.filter((r) => !r.is_live);
  const postmark = postmarkFor(home.delivery);
  const nothing = !q || (products.length === 0 && regions.length === 0);
  // The count only counts what the search returned: with more behind "Show more", it says so ("24+").
  const pieces = more ? `${products.length}+ pieces` : plural(products.length, 'piece');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Search</h1>
        <form action="/search" className="mt-6 flex max-w-3xl gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <div className="relative flex flex-1">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search a state, a saree, a spice…"
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
            <p className="text-ink-muted text-[15px]">No products match “{q}”.</p>
          ) : (
            <ProductGrid>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ProductGrid>
          )}
          {more ? (
            <Link
              href={`/search?${new URLSearchParams({ q, show: String(show + PAGE) }).toString()}`}
              scroll={false}
              className="border-line bg-paper hover:border-ink font-ui inline-flex min-h-12 items-center rounded-pill border px-6 text-[15px]"
            >
              Show more
            </Link>
          ) : null}
        </section>
      ) : null}

      {nothing ? (
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
    </div>
  );
}

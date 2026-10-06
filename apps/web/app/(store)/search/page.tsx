import Link from 'next/link';

import { getHomeCached, searchProducts } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { RegionGrid } from '@/features/regions/region-card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

type SearchParams = Promise<{ q?: string | string[]; show?: string | string[] }>;

const PAGE = 24;

/**
 * Products (full-text, one round trip) and regions (from the cached home data). No session. Results come 24 at a
 * time with "Show more" (?show=), so a broad search never puts hundreds of photos on one page.
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
  const [home, found] = q
    ? await Promise.all([getHomeCached(), searchProducts(q, show + 1, show === PAGE)])
    : [null, []];
  const products = found.slice(0, show);
  const needle = q.toLowerCase();
  const regions = home ? home.regions.filter((r) => r.name.toLowerCase().includes(needle)) : [];

  return (
    <div className="space-y-8">
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Search</h1>
      <form action="/search" className="flex max-w-3xl gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search a state, a saree, a spice…"
          className="border-line bg-paper focus:border-ink min-h-12 flex-1 rounded-pill border px-4 text-[15px] outline-none"
        />
        <button type="submit" className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium">
          Search
        </button>
      </form>

      {q ? (
        <>
          {regions.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-hero text-ink text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em]">States</h2>
              <RegionGrid regions={regions} />
            </section>
          ) : null}
          <section className="space-y-3">
            <h2 className="font-hero text-ink text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em]">Products</h2>
            {products.length === 0 ? (
              <p className="text-ink-muted text-sm">No products match “{q}”.</p>
            ) : (
              <ProductGrid>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </ProductGrid>
            )}
            {found.length > show ? (
              <Link
                href={`/search?${new URLSearchParams({ q, show: String(show + PAGE) }).toString()}`}
                scroll={false}
                className="border-line bg-paper hover:border-ink font-ui inline-flex min-h-12 items-center rounded-pill border px-6 text-[15px]"
              >
                Show more
              </Link>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

import { getHomeCached, searchProducts } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { RegionGrid } from '@/features/regions/region-card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Search' };

type SearchParams = Promise<{ q?: string | string[] }>;

/** Products (full-text, one round trip) and regions (from the cached home data). No session. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? '';
  const [home, products] = q ? await Promise.all([getHomeCached(), searchProducts(q)]) : [null, []];
  const needle = q.toLowerCase();
  const regions = home ? home.regions.filter((r) => r.name.toLowerCase().includes(needle)) : [];

  return (
    <div className="space-y-8">
      <form action="/search" className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search a state, a saree, a spice…"
          className="border-line bg-canvas min-h-11 flex-1 rounded-sm border px-3"
        />
        <button type="submit" className="bg-brand text-canvas min-h-11 rounded-sm px-4 text-sm">
          Search
        </button>
      </form>

      {q ? (
        <>
          {regions.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-ink text-lg font-medium">States</h2>
              <RegionGrid regions={regions} />
            </section>
          ) : null}
          <section className="space-y-3">
            <h2 className="text-ink text-lg font-medium">Products</h2>
            {products.length === 0 ? (
              <p className="text-ink-muted text-sm">No products match “{q}”.</p>
            ) : (
              <ProductGrid>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </ProductGrid>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

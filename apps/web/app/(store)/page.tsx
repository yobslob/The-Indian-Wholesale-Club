import Link from 'next/link';

import { getHomeCached } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';
import { HomeHero } from '@/features/home/home-hero';
import { PickHome } from '@/features/regions/pick-home';

/**
 * Home (storefront.md, design.md §Direction, D-050 – D-055): the photo hero, Just listed, Pick your home.
 * One cached store_home() call (PR-1, PR-2). Runs edge to edge (data-bleed); sections keep the gutter.
 */
export default async function HomePage(): Promise<React.JSX.Element> {
  const home = await getHomeCached();

  return (
    <div data-bleed>
      <HomeHero />

      {home.just_listed.length > 0 ? (
        <section aria-labelledby="just-listed" className="px-[var(--gut)] py-[clamp(28px,3.4vw,56px)]">
          <div className="mb-[clamp(18px,2vw,28px)] flex flex-wrap items-end justify-between gap-4">
            <h2 id="just-listed" className="font-hero text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]">
              Just listed
            </h2>
            <Link
              href="/clothing"
              className="font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 items-center rounded-pill border px-5 text-sm font-medium"
            >
              See everything
            </Link>
          </div>
          <ProductGrid>
            {home.just_listed.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductGrid>
        </section>
      ) : null}

      <section id="pick" aria-labelledby="pick-home" className="px-[var(--gut)] py-[clamp(28px,3.4vw,56px)]">
        <div className="mb-[clamp(18px,2vw,28px)]">
          <h2 id="pick-home" className="font-hero text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]">
            Pick your home
          </h2>
          <p className="text-ink-muted mt-1.5 text-sm">
            All 28 states and 8 union territories. Find yours on the map or by name.
          </p>
        </div>
        <PickHome regions={home.regions} delivery={home.delivery} />
      </section>
    </div>
  );
}

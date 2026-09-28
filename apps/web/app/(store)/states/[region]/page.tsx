import { notFound } from 'next/navigation';

import { getHomeCached, getRegionPageCached } from '@/features/catalog/data';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';

import type { RegionProductCard } from '@repo/db/store';
import type { Metadata } from 'next';

type Params = Promise<{ region: string }>;

/** The 36 region pages are built ahead of time and refreshed from the cache (PR-1). */
export async function generateStaticParams(): Promise<{ region: string }[]> {
  const { regions } = await getHomeCached();
  return regions.map((r) => ({ region: r.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await getRegionPageCached((await params).region);
  return page ? { title: page.region.name } : {};
}

function Section({
  id,
  title,
  products,
}: {
  id: string;
  title: string;
  products: RegionProductCard[];
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4">
      <h2 className="text-ink text-lg font-medium">{title}</h2>
      {products.length === 0 ? (
        <p className="text-ink-muted text-sm">Coming soon.</p>
      ) : (
        <ProductGrid>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} available={p.available} />
          ))}
        </ProductGrid>
      )}
    </section>
  );
}

/** The core page (storefront.md §The region page). One cached store_region_page() call. */
export default async function RegionPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const page = await getRegionPageCached((await params).region);
  if (!page) notFound();
  const { region, products } = page;
  const clothing = products.filter((p) => p.product_type === 'clothing');
  const spices = products.filter((p) => p.product_type === 'spice');

  return (
    <div
      className="space-y-10"
      style={
        region.accent_color
          ? ({ '--region-accent': region.accent_color } as React.CSSProperties)
          : undefined
      }
    >
      <header className="border-region space-y-2 border-l-4 pl-4">
        {region.greeting_native ? (
          <p
            className="text-region text-4xl"
            lang={region.greeting_script ? `und-${region.greeting_script}` : undefined}
          >
            {region.greeting_native}
          </p>
        ) : null}
        {region.greeting_latin || region.greeting_meaning ? (
          <p className="text-ink-muted text-sm">
            {[region.greeting_latin, region.greeting_meaning].filter(Boolean).join(' · ')}
          </p>
        ) : null}
        <h1 className="text-ink text-2xl font-semibold">{region.name}</h1>
        {region.tagline ? <p className="text-ink">{region.tagline}</p> : null}
        {region.story ? (
          <p className="text-ink-muted max-w-2xl whitespace-pre-line">{region.story}</p>
        ) : null}
      </header>

      {!region.is_live ? (
        <p className="bg-surface text-ink rounded-md p-4 text-sm">
          {region.name} is coming soon. We are adding its clothing and spices.
        </p>
      ) : null}

      <nav className="border-line flex gap-4 border-b text-sm" aria-label="Product type">
        <a href="#clothing" className="border-region border-b-2 pb-2 font-medium">
          Clothing ({clothing.length})
        </a>
        <a href="#spices" className="pb-2">
          Spices ({spices.length})
        </a>
      </nav>

      <Section id="clothing" title="Clothing" products={clothing} />
      <Section id="spices" title="Spices" products={spices} />
    </div>
  );
}

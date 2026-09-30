import { ProductCard } from './product-card';

import type { RegionProductCard } from '@repo/db/store';

/**
 * "Curated for you" in one card (D-051): an intro and up to four small cards on the same five-column grid.
 * The picks are an admin's per region (D-056); personalising them from saves and views comes later.
 */
export function CuratedCard({
  id,
  products,
  regionName,
}: {
  id: string;
  products: RegionProductCard[];
  regionName: string;
}): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={id} className="py-[clamp(28px,3.4vw,56px)]">
      <div className="bg-surface grid grid-cols-2 gap-[var(--gap)] rounded-lg p-[clamp(18px,2vw,32px)] md:grid-cols-3 xl:grid-cols-5">
        <div className="col-span-2 flex flex-col justify-between gap-5 p-1 md:col-span-3 xl:col-span-1">
          <div>
            <p className="font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Curated for you</p>
            <h2 id={id} className="font-hero mt-2.5 text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]">
              Picked for you
            </h2>
            <p className="text-ink-muted mt-2 text-sm">Chosen by us from {regionName}.</p>
          </div>
        </div>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} size="sm" />
        ))}
      </div>
    </section>
  );
}

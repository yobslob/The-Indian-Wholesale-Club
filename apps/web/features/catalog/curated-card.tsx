import { ProductStrip } from './product-row';

import type { RegionProductCard } from '@repo/db/store';

/**
 * "Curated for you" in one card (D-051): an intro, then the picks as a row of small cards that scrolls sideways
 * (D-062). The picks are an admin's per region (D-056); personalising them from saves and views comes later.
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
    <section aria-labelledby={id} className="py-[clamp(24px,3vw,48px)]">
      <div className="bg-surface overflow-hidden rounded-lg px-[var(--gut)] py-[clamp(18px,2vw,32px)]">
        <p className="font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Curated for you</p>
        <h2 id={id} className="font-heading mt-2.5 text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]">
          Picked for you
        </h2>
        <p className="text-ink-muted mb-[clamp(16px,1.8vw,24px)] mt-2 text-sm">Chosen by us from {regionName}.</p>
        <ProductStrip products={products} label="Curated for you" size="sm" />
      </div>
    </section>
  );
}

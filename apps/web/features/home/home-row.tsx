import { sectionHeading } from '@/features/catalog/product-row';

import { LazyStrip, type RowCard } from './lazy-sections';

/**
 * A titled row of cards on Home, as product-row.tsx's ProductRow draws it (same heading and card widths), with the cards
 * drawn as the row comes near (launch QA C-2, lazy-sections.tsx).
 */
export function HomeRow({
  id,
  title,
  sub,
  products,
}: {
  id: string;
  title: string;
  sub?: string;
  products: RowCard[];
}): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <div className="mb-[clamp(16px,1.8vw,24px)]">
        <h2 id={`${id}-h`} className={sectionHeading} data-reveal="">
          {title}
        </h2>
        {sub ? <p className="text-ink-muted mt-1.5 text-sm">{sub}</p> : null}
      </div>
      <LazyStrip products={products} label={title} />
    </section>
  );
}

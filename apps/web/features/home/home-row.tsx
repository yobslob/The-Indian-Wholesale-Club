import { seeAllPill, sectionHeading } from '@/features/catalog/product-row';
import { IntentLink } from '@/features/shell/intent-link';

import { LazyStrip, type RowCard } from './lazy-sections';

/**
 * A titled row of cards on Home, as product-row.tsx's ProductRow draws it (same heading, See all and card widths),
 * with the cards drawn as the row comes near (launch QA C-2, lazy-sections.tsx). Home's 7-day row (D-154).
 */
export function HomeRow({
  id,
  title,
  products,
  href,
  quickTag,
}: {
  id: string;
  title: string;
  products: RowCard[];
  href: string;
  quickTag?: boolean;
}): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <div className="mb-[clamp(16px,1.8vw,24px)] flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className={sectionHeading} data-reveal="">
            {title}
          </h2>
        </div>
        <IntentLink href={href} className={seeAllPill}>
          See all<span className="sr-only"> {title}</span>
          <span aria-hidden="true" className="-mr-1 transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </IntentLink>
      </div>
      <LazyStrip products={products} label={title} quickTag={quickTag} />
    </section>
  );
}

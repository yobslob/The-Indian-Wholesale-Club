import Link from 'next/link';

import { ProductCard } from './product-card';
import { RowScroller } from './row-scroller';

import type { ProductCard as ProductCardData, RegionProductCard } from '@repo/db/store';

type CardData = ProductCardData & Partial<Pick<RegionProductCard, 'available' | 'quick_add'>>;

export const sectionHeading = 'font-hero text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]';
export const seeAllPill =
  'font-ui border-line bg-paper hover:border-ink inline-flex min-h-11 shrink-0 items-center rounded-pill border px-5 text-sm font-medium';

/** Cards a row shows before it is scrolled sideways on a wide screen: only these get the scroll reveal. */
const REVEALED = 5;

/** The cards of a row, each a fixed width so the row scrolls sideways (D-062). */
export function ProductStrip<T extends CardData>({
  products,
  label,
  size = 'md',
  badge,
}: {
  products: T[];
  label: string;
  size?: 'md' | 'sm';
  badge?: (p: T) => React.ReactNode;
}): React.JSX.Element {
  const width = size === 'sm' ? 'w-[clamp(148px,17vw,224px)]' : 'w-[clamp(176px,23vw,304px)]';
  return (
    <RowScroller label={label}>
      {products.map((p, i) => (
        <li key={p.id} className={`${width} shrink-0 snap-start`}>
          <ProductCard product={p} size={size} badge={badge?.(p)} reveal={i < REVEALED} />
        </li>
      ))}
    </RowScroller>
  );
}

/**
 * A titled row of product cards (D-062). `href` adds "See all", the page with every card of that list; rows that
 * already show their whole list (Most wanted, Leaving soon) leave it out.
 */
export function ProductRow<T extends CardData>({
  id,
  title,
  sub,
  products,
  href,
  size,
  badge,
}: {
  id: string;
  title: string;
  sub?: string;
  products: T[];
  href?: string;
  size?: 'md' | 'sm';
  badge?: (p: T) => React.ReactNode;
}): React.JSX.Element | null {
  if (products.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <div className="mb-[clamp(16px,1.8vw,24px)] flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${id}-h`} className={sectionHeading}>
            {title}
          </h2>
          {sub ? <p className="text-ink-muted mt-1.5 text-sm">{sub}</p> : null}
        </div>
        {href ? (
          <Link href={href} className={seeAllPill}>
            See all<span className="sr-only"> {title}</span>
          </Link>
        ) : null}
      </div>
      <ProductStrip products={products} label={title} size={size} badge={badge} />
    </section>
  );
}

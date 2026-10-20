'use client';

import { formatUsd } from '@repo/shared/domain';

import { browseHref, withFilter, type BrowseQuery } from './browse-query';
import styles from './finishing-drawer.module.css';
import { ProductStrip } from './product-row';

import type { ProductCard } from '@repo/db/store';

/** Cards of the main list each drawer follows (one page of Show more). */
export const DRAWER_EVERY = 24;
/** Finishing touches in one drawer (the database sends 12 for every 24 cards). */
export const DRAWER_SIZE = 12;

/**
 * The jewellery drawer (D-144, plan F11): on Clothing's default view, accessories and turbans leave the price order
 * and open as a dark velvet band after the second row of each 24 cards, a sideways row of smaller cards with their
 * + and − n +. It sits after every card in the page source and takes its row in the grid (`placed`), so the cards'
 * column drift (D-116) is unchanged. See all opens the accessories in place.
 */
export function FinishingDrawer({
  items,
  index,
  placed,
  query,
  onChange,
}: {
  items: ProductCard[];
  index: number;
  /** Its block has two full rows at any width: the drawer goes after them; else after the last card. */
  placed: boolean;
  query: BrowseQuery;
  onChange: (next: BrowseQuery) => void;
}): React.JSX.Element {
  const id = `touches-${index}`;
  const from = Math.min(...items.map((p) => p.price_cents));
  const next = withFilter(query, { category: 'accessories' });
  return (
    <section
      aria-labelledby={`${id}-h`}
      className={styles.drawer}
      data-drawer=""
      data-placed={placed ? '' : undefined}
      style={{ '--d': index } as React.CSSProperties}
    >
      <div className={styles.head}>
        <h2 id={`${id}-h`} className="font-heading m-0 text-[clamp(22px,1.8vw,30px)] font-medium leading-tight tracking-[-0.02em]">
          Finishing touches{' '}
          <span className={styles.from}>
            <span className={styles.dot}>· </span>from {formatUsd(from).replace(/\.00$/, '')}
          </span>
        </h2>
        <a
          href={browseHref('clothing', next)}
          className={styles.seeAll}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onChange(next);
          }}
        >
          See all<span className="sr-only"> accessories</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
      <ProductStrip products={items} label={index === 0 ? 'Finishing touches' : `Finishing touches, part ${index + 1}`} size="sm" />
    </section>
  );
}

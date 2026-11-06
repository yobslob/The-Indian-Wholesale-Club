'use client';

import { browseHref, withFilter, type BrowseQuery } from './browse-query';
import styles from './group-rail.module.css';

import type { BrowseMeta } from './use-browse';
import type { ProductType } from '@repo/shared/domain';

/** The categories public/icons/groups.svg draws; any other gets its plain tag. */
const ICONS = new Set([
  'sarees', 'kurtas', 'suits-and-sets', 'lehengas', 'dupattas-and-stoles', 'shawls', 'dhotis-and-mundus',
  'jeans-and-trousers', 'shirts-and-tops', 'co-ords-and-dresses', 'jackets-and-knitwear', 'headwear', 'footwear',
  'accessories', 'kids', 'fabrics', 'whole-spices', 'ground-spices', 'masala-blends', 'pickles-and-chutneys',
  'papad-and-wadi', 'snacks-and-namkeen', 'sweets', 'rice-flours-and-staples', 'tea-and-drinks',
  'pooja-and-spiritual', 'thaali-and-serveware', 'handicrafts-and-decor',
]);

/**
 * D-190 (founder 2026-11-06): the page's groups as a slim column of small icons with their names, down the left side, so
 * a phone can jump between them while scrolling. The groups come with the page's own read (meta.categories), so it
 * costs no read. Every group is a real link to its address; a plain click swaps the cards in place, as a filter does.
 */
export function GroupRail({
  productType,
  query,
  meta,
  onChange,
}: {
  productType: ProductType;
  query: BrowseQuery;
  meta: BrowseMeta;
  onChange: (next: BrowseQuery) => void;
}): React.JSX.Element {
  const group = (slug: string | undefined, name: string): React.JSX.Element => {
    const next = withFilter(query, { category: slug });
    const on = query.category === slug;
    return (
      <li key={slug ?? 'all'}>
        <a
          href={browseHref(productType, next)}
          className={styles.group}
          aria-current={on ? 'true' : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // a new tab or window
            e.preventDefault();
            onChange(next);
          }}
        >
          <svg aria-hidden="true" className={styles.icon}>
            <use href={`/icons/groups.svg#${slug ? (ICONS.has(slug) ? slug : 'tag') : 'all'}`} />
          </svg>
          {name}
        </a>
      </li>
    );
  };
  return (
    <nav aria-label="Groups" className={`${styles.rail} no-scrollbar font-ui`}>
      <ul>
        {group(undefined, 'All')}
        {meta.categories.map((c) => group(c.slug, c.name))}
      </ul>
    </nav>
  );
}

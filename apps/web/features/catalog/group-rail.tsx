'use client';

import { mediaUrl } from '@/lib/site';

import { browseHref, withFilter, type BrowseQuery } from './browse-query';
import styles from './group-rail.module.css';
import { StorePhoto } from './store-photo';
import { SUB_PHOTOS } from './sub-photos';

import type { BrowseMeta } from './use-browse';
import type { ProductType } from '@repo/shared/domain';

/**
 * D-191 (founder 2026-11-07): the sub-categories as a slim column of small photos with their names, down the left side, so
 * a phone can jump between them while scrolling. Each comes with the page's own read (meta.subcategories), so it costs no
 * read. Its photo is the founder's (sub-photos.ts), else its first piece's. Every one is a real link to its address; a
 * plain click swaps the cards in place, as a filter does.
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
  const item = (slug: string | undefined, name: string, photo: string | null): React.JSX.Element => {
    const next = withFilter(query, { sub: slug });
    return (
      <li key={slug ?? 'all'}>
        <a
          href={browseHref(productType, next)}
          className={styles.group}
          aria-current={query.sub === slug ? 'true' : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // a new tab or window
            e.preventDefault();
            onChange(next);
          }}
        >
          <span className={styles.photo} aria-hidden="true">
            {photo ? <StorePhoto src={photo} alt="" sizes="52px" className="object-cover" /> : null}
          </span>
          {name}
        </a>
      </li>
    );
  };
  const photoOf = (s: BrowseMeta['subcategories'][number]): string | null =>
    SUB_PHOTOS[s.slug] ?? (s.image_path ? mediaUrl(s.image_path) : null);
  const first = meta.subcategories[0];
  return (
    <nav aria-label="Sub-categories" className={`${styles.rail} no-scrollbar font-ui`}>
      <ul>
        {item(undefined, 'All', first ? photoOf(first) : null)}
        {meta.subcategories.map((s) => item(s.slug, s.name, photoOf(s)))}
      </ul>
    </nav>
  );
}

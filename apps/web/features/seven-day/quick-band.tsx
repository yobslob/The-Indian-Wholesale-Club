'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { fetchBrowse } from '@/features/catalog/browse-fetch';
import { browseSearch, inQuickStore, PAGE, parseBrowseQuery } from '@/features/catalog/browse-query';
import { ProductStrip } from '@/features/catalog/product-row';

import { quickHref } from './links';
import styles from './quick-band.module.css';

import type { ProductCard } from '@repo/db/store';
import type { ProductType } from '@repo/shared/domain';

/** Cards the band shows; the button opens the rest. */
const SHOWN = 12;

/**
 * The 7-day store inside a state's Food and Home & gifts (founder 2026-11-03: "like a strip in between (like finishing
 * touches on clothing) ... just enough to reach the 7 day page"): a band after the second row of cards with the 7-day
 * store's first pieces of that type and its button. The cards are the 7-day store's own See all page's first page,
 * the same cached /api/browse answer (no new cache entry, D-145), read once the band is drawn.
 */
export function QuickBand({
  productType,
  days,
  placed,
}: {
  productType: ProductType;
  days: number;
  /** Two rows of cards above it at any width: the band goes after them, else after the last card. */
  placed: boolean;
}): React.JSX.Element | null {
  const [cards, setCards] = useState<ProductCard[] | null | 'none'>(null);

  useEffect(() => {
    let gone = false;
    const search = browseSearch(inQuickStore(parseBrowseQuery({})));
    fetchBrowse(`/api/browse?type=${productType}&offset=0&limit=${PAGE}&${search}`)
      .then((p) => !gone && setCards(p.products.length > 0 ? p.products.slice(0, SHOWN) : 'none'))
      // a band that cannot load is left out: the list around it is what the reader came for
      .catch(() => !gone && setCards('none'));
    return () => {
      gone = true;
    };
  }, [productType]);

  if (cards === 'none') return null;
  return (
    <section aria-labelledby={`quick-band-${productType}`} className={styles.band} data-placed={placed ? '' : undefined}>
      <div className={styles.head}>
        <h2
          id={`quick-band-${productType}`}
          className="font-heading m-0 whitespace-nowrap text-[clamp(22px,1.8vw,30px)] font-medium leading-tight tracking-[-0.02em]"
        >
          Arrives in <span className={styles.days}>{days}</span> days
        </h2>
        <Link href={quickHref(productType)} prefetch={false} className={styles.go}>
          {/* phones: "7-day store", so the heading keeps its one line */}
          <span>
            <span className="hidden sm:inline">Shop the </span>7-day store
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
      {cards ? (
        <ProductStrip products={cards} label={`Arrives in ${days} days`} size="sm" quickTag={false} headed />
      ) : (
        <div className={styles.waiting} aria-hidden="true" />
      )}
    </section>
  );
}

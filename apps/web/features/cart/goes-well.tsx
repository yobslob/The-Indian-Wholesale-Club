'use client';

import { useEffect, useState } from 'react';

import { ProductCard } from '@/features/catalog/product-card';

import { useCart } from './store';

import type { BrowsePage } from '@repo/db/store';

type Card = BrowsePage['products'][number];

/**
 * "Goes well with" (D-140, plan L6): under the bag's lines, four small cards of the last piece's type from its state,
 * each with its + (the size ribbon or sheet), so the bag panel on a phone is not a tall empty page between its line and
 * its totals. Asks once per last piece.
 */
export function GoesWellWith(): React.JSX.Element | null {
  const lines = useCart((s) => s.lines);
  const last = lines[lines.length - 1];
  const key = last ? `${last.productId}:${last.regionSlug ?? ''}` : '';
  const [cards, setCards] = useState<Card[]>([]);
  const type = last?.productType === 'food' || last?.productType === 'home' ? last.productType : 'clothing';

  useEffect(() => {
    if (!last) return;
    let live = true;
    const params = new URLSearchParams({ type, not: lines.map((l) => l.productId).join(',') });
    if (last.regionSlug) params.set('state', last.regionSlug);
    fetch(`/api/goes-well?${params.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ cards: Card[] }>) : { cards: [] }))
      .then((d) => {
        if (live) setCards(d.cards);
      })
      .catch(() => undefined); // a suggestion row is optional: nothing shows
    return () => {
      live = false;
    };
    // once per last piece
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!last || cards.length < 2) return null;
  return (
    <section aria-labelledby="goes-well" className="border-line mt-4 border-t pt-4">
      <h3 id="goes-well" className="font-heading m-0 mb-3 text-[17px] font-medium">
        Goes well with
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <ProductCard key={c.id} product={c} size="sm" layout="grid" reveal={false} />
        ))}
      </div>
    </section>
  );
}

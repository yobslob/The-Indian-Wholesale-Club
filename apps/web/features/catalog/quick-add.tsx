'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/features/cart/store';

import type { ProductCard, QuickAdd as QuickAddData } from '@repo/db/store';

/** On the card's photo, bottom right (D-080): a round + so the name keeps the card's full width. */
const spot = 'font-ui absolute bottom-2.5 right-2.5 z-[1]';
const round = `${spot} grid size-10 place-items-center rounded-full border border-line bg-paper text-black shadow-sm transition-colors hover:border-ink`;

function Icon({ d }: { d: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const PLUS = 'M12 5v14M5 12h14';
const CHECK = 'M5 12.5l4.5 4.5L19 7.5';

/**
 * A card's + (D-080). Only a product with exactly one variant in stock is added straight away (quick_add from
 * store_*); a piece with sizes or colours opens the product page to choose. Prices here are for display only:
 * checkout re-prices on the server.
 */
export function QuickAdd({
  product,
  quickAdd,
  available,
  href,
}: {
  product: Pick<ProductCard, 'id' | 'name' | 'slug' | 'region_slug' | 'region_name' | 'primary_image_path'>;
  quickAdd: QuickAddData | null | undefined;
  available: number | undefined;
  href: string;
}): React.JSX.Element {
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  if (available === 0) {
    return (
      <span className={`${spot} bg-paper text-ink-muted rounded-pill px-3 py-1.5 text-xs font-medium`}>Sold out</span>
    );
  }
  if (!quickAdd) {
    return (
      <Link href={href} className={round} aria-label={`Choose options for ${product.name}`}>
        <Icon d={PLUS} />
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={round}
      aria-label={added ? `${product.name} added to your bag` : `Add ${product.name} to your bag`}
      onClick={() => {
        add(
          {
            variantId: quickAdd.variant_id,
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            regionSlug: product.region_slug,
            regionName: product.region_name,
            variantLabel: quickAdd.label,
            unitPriceCents: quickAdd.price_cents,
            imagePath: product.primary_image_path,
          },
          1,
        );
        setAdded(true);
      }}
    >
      <Icon d={added ? CHECK : PLUS} />
    </button>
  );
}

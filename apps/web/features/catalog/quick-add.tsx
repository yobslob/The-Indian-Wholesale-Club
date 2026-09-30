'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useCart } from '@/features/cart/store';

import type { ProductCard, QuickAdd as QuickAddData } from '@repo/db/store';

const pill =
  'font-ui inline-flex min-h-10 flex-none items-center justify-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-paper px-4 text-sm font-medium shadow-sm hover:border-ink';

/**
 * A card's "Add" (the founder's reference grid). Only a product with exactly one variant in stock is added
 * straight away (quick_add from store_*); anything else opens the product page to choose. Prices here are
 * for display only: checkout re-prices on the server.
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
      <span className={`${pill} text-ink-muted cursor-default hover:border-line`} aria-disabled="true">
        Sold out
      </span>
    );
  }
  if (!quickAdd) {
    return (
      <Link href={href} className={pill} aria-label={`Choose options for ${product.name}`}>
        Choose
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={pill}
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
      {added ? '✓ Added' : '＋ Add'}
    </button>
  );
}

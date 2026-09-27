'use client';

import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import { useCartStore, useWishlistStore } from '@/lib/store';

export default function WishlistPage(): React.JSX.Element {
  const { items, removeItem, clearWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-screen-2xl items-center justify-center px-4">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const handleMoveToBag = (item: (typeof items)[number]) => {
    addItem({
      variantId: item.productId, // Fallback variant ID
      productId: item.productId,
      productName: item.name,
      productSlug: item.slug,
      priceCents: item.basePriceCents,
      quantity: 1,
      size: null,
      colorName: null,
      imageUrl: item.imageUrl ?? null,
    });
    removeItem(item.productId);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl px-4 py-20 text-center md:px-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <Heart className="h-10 w-10 text-neutral-400" />
        </div>
        <h1 className="font-display text-primary mt-6 text-3xl font-bold tracking-tight">
          Your Wishlist is Empty
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Save your favorite essentials so you can easily find them later.
        </p>
        <div className="mt-8">
          <Link
            href="/shop"
            className="bg-primary text-primary-foreground inline-flex h-12 items-center justify-center rounded-md px-8 text-sm font-semibold uppercase tracking-wider hover:bg-neutral-800"
          >
            Explore the Collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-10 md:px-8 lg:px-12">
      {/* Header bar */}
      <div className="flex items-baseline justify-between border-b border-neutral-200 pb-6">
        <div>
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center space-x-2 text-xs text-neutral-500">
              <li>
                <Link href="/" className="hover:text-primary">
                  Home
                </Link>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-neutral-400">/</span>
                <span className="font-medium text-neutral-900">Wishlist</span>
              </li>
            </ol>
          </nav>
          <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
            My Wishlist
          </h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
            {items.length} {items.length === 1 ? 'saved item' : 'saved items'}
          </p>
        </div>
        <button
          type="button"
          onClick={clearWishlist}
          className="hover:text-destructive text-xs font-medium text-neutral-500 hover:underline"
        >
          Clear Wishlist
        </button>
      </div>

      {/* Grid of Wishlisted Products */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const price = item.basePriceCents / 100;
          const comparePrice = item.compareAtPriceCents ? item.compareAtPriceCents / 100 : null;
          const isOnSale = comparePrice !== null && comparePrice > price;

          return (
            <div key={item.productId} className="group relative flex flex-col justify-between">
              <div>
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-neutral-100">
                  <Link href={`/product/${item.slug}`}>
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                        No image
                      </div>
                    )}
                  </Link>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
                    className="hover:text-destructive absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1.5 text-neutral-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
                    aria-label={`Remove ${item.name} from wishlist`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Details */}
                <div className="mt-3">
                  <Link href={`/product/${item.slug}`}>
                    <h3 className="hover:text-primary truncate text-sm font-medium text-neutral-900">
                      {item.name}
                    </h3>
                  </Link>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${isOnSale ? 'text-destructive' : 'text-neutral-900'}`}
                    >
                      {formatUSD(price)}
                    </span>
                    {isOnSale && comparePrice && (
                      <span className="text-sm text-neutral-400 line-through">
                        {formatUSD(comparePrice)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Move to Bag CTA */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handleMoveToBag(item)}
                  className="bg-primary text-primary-foreground flex h-10 w-full items-center justify-center gap-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Move to Bag
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

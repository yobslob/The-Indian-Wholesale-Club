'use client';

import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import { useWishlistStore } from '@/lib/store';

import type { Product, ProductImage } from '@repo/shared/types';

interface ProductCardProps {
  product: Product;
  image?: ProductImage | null;
}

export function ProductCard({ product, image }: ProductCardProps): React.JSX.Element {
  const { isInWishlist, toggleItem } = useWishlistStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWishlisted = mounted ? isInWishlist(product.id) : false;
  const price = product.base_price_cents / 100;
  const comparePrice = product.compare_at_price_cents ? product.compare_at_price_cents / 100 : null;
  const isOnSale = comparePrice !== null && comparePrice > price;
  const discountPercent = isOnSale ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  return (
    <div className="group relative">
      {/* Image container */}
      <Link href={`/product/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-neutral-100">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt_text ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              No image
            </div>
          )}

          {/* Sale badge */}
          {isOnSale && (
            <span className="bg-destructive text-destructive-foreground absolute left-2 top-2 rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              -{discountPercent}%
            </span>
          )}

          {/* Quick actions overlay (desktop hover) */}
          <div className="absolute inset-x-0 bottom-0 translate-y-full transition-transform duration-200 group-hover:translate-y-0">
            <button
              type="button"
              className="bg-primary/90 text-primary-foreground hover:bg-primary w-full px-4 py-2.5 text-xs font-medium uppercase tracking-wider backdrop-blur-sm transition-colors"
            >
              Quick Add
            </button>
          </div>
        </div>
      </Link>

      {/* Wishlist button with micro-interaction */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.08 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleItem({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            basePriceCents: product.base_price_cents,
            compareAtPriceCents: product.compare_at_price_cents,
            imageUrl: image?.url,
          });
        }}
        className={`absolute right-2 top-2 z-10 rounded-full p-1.5 shadow-sm backdrop-blur-sm transition-colors ${
          isWishlisted
            ? 'text-destructive bg-white'
            : 'hover:text-primary bg-white/80 text-neutral-600 hover:bg-white'
        }`}
        aria-label={
          isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`
        }
      >
        <motion.div
          animate={isWishlisted ? { scale: [1, 1.25, 1] } : { scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </motion.div>
      </motion.button>

      {/* Product info */}
      <div className="mt-3">
        <Link href={`/product/${product.slug}`} className="block">
          <h3 className="group-hover:text-accent text-sm font-medium text-neutral-900 transition-colors">
            {product.name}
          </h3>
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`text-sm font-medium ${isOnSale ? 'text-destructive' : 'text-neutral-900'}`}
          >
            {formatUSD(price)}
          </span>
          {isOnSale && comparePrice && (
            <span className="text-sm text-neutral-400 line-through">{formatUSD(comparePrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

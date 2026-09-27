'use client';

import { motion } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Heart,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  Star,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import { useCartStore, useWishlistStore } from '@/lib/store';

import type { Category, Product, ProductVariant } from '@repo/shared/types';

interface ProductInfoProps {
  product: Product;
  category: Category | null;
  variants: ProductVariant[];
  primaryImageUrl?: string | null;
}

export function ProductInfo({
  product,
  category,
  variants,
  primaryImageUrl,
}: ProductInfoProps): React.JSX.Element {
  const { addItem } = useCartStore();
  const { isInWishlist, toggleItem } = useWishlistStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWishlisted = mounted ? isInWishlist(product.id) : false;
  // Extract distinct colors
  const colors = useMemo(() => {
    const map = new Map<string, string | null>();
    variants.forEach((v) => {
      if (v.color_name) {
        map.set(v.color_name, v.color_hex);
      }
    });
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  // Extract distinct sizes
  const sizes = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.size) set.add(v.size);
    });
    return Array.from(set);
  }, [variants]);

  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0]?.name ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(sizes[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Find active variant matching selected color & size
  const activeVariant = useMemo(() => {
    return (
      variants.find((v) => {
        const colorMatches = !selectedColor || v.color_name === selectedColor;
        const sizeMatches = !selectedSize || v.size === selectedSize;
        return colorMatches && sizeMatches;
      }) ?? variants[0]
    );
  }, [variants, selectedColor, selectedSize]);

  const priceCents = activeVariant?.price_cents ?? product.base_price_cents;
  const price = priceCents / 100;
  const comparePrice = product.compare_at_price_cents ? product.compare_at_price_cents / 100 : null;
  const isOnSale = comparePrice !== null && comparePrice > price;
  const discountPercent = isOnSale ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;

  const isOutOfStock = (activeVariant?.inventory_count ?? 0) <= 0;
  const isLowStock =
    !isOutOfStock &&
    (activeVariant?.inventory_count ?? 0) <= (activeVariant?.low_stock_threshold ?? 5);

  const handleAddToCart = () => {
    if (isOutOfStock || isAdding || !activeVariant) return;
    setIsAdding(true);

    addItem({
      variantId: activeVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      priceCents: activeVariant.price_cents ?? product.base_price_cents,
      quantity,
      size: activeVariant.size,
      colorName: activeVariant.color_name,
      imageUrl: primaryImageUrl ?? null,
    });

    setTimeout(() => {
      setIsAdding(false);
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 3000);
    }, 300);
  };

  return (
    <div className="flex flex-col">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center space-x-2 text-xs text-neutral-500">
          <li>
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <li className="flex items-center space-x-2">
            <ChevronRight className="h-3 w-3 text-neutral-400" />
            <Link href="/shop" className="hover:text-primary">
              Shop
            </Link>
          </li>
          {category && (
            <li className="flex items-center space-x-2">
              <ChevronRight className="h-3 w-3 text-neutral-400" />
              <Link href={`/category/${category.slug}`} className="hover:text-primary">
                {category.name}
              </Link>
            </li>
          )}
        </ol>
      </nav>

      {/* Product Title */}
      <h1 className="font-display text-primary text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
        {product.name}
      </h1>

      {/* Reviews Rating & Stock Status */}
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-1 text-xs">
          <div className="flex text-amber-500">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-current" />
            ))}
          </div>
          <span className="font-semibold text-neutral-800">4.9</span>
          <span className="text-neutral-500">(128 reviews)</span>
        </div>

        <span className="text-neutral-300">·</span>

        {isOutOfStock ? (
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Only {activeVariant.inventory_count} Left
          </span>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            In Stock
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mt-4 flex items-center gap-3">
        <span
          className={`text-2xl font-bold ${isOnSale ? 'text-destructive' : 'text-neutral-900'}`}
        >
          {formatUSD(price)}
        </span>
        {isOnSale && comparePrice && (
          <span className="text-lg text-neutral-400 line-through">{formatUSD(comparePrice)}</span>
        )}
        {isOnSale && (
          <span className="bg-destructive text-destructive-foreground rounded-sm px-2 py-0.5 text-xs font-medium uppercase tracking-wider">
            Save {discountPercent}%
          </span>
        )}
      </div>

      {/* Short description */}
      {product.description && (
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">{product.description}</p>
      )}

      <div className="my-6 border-t border-neutral-200" />

      {/* Color Selector */}
      {colors.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Color: <span className="font-normal text-neutral-600">{selectedColor}</span>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            {colors.map((c) => {
              const isSelected = selectedColor === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.name)}
                  className={`group relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected ? 'border-primary ring-primary/20 ring-2' : 'border-neutral-300'
                  }`}
                  aria-label={`Select color ${c.name}`}
                >
                  <span
                    className="h-6 w-6 rounded-full border border-black/10"
                    style={{ backgroundColor: c.hex ?? '#171717' }}
                  />
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Check
                        className={`h-3.5 w-3.5 ${
                          c.hex?.toLowerCase() === '#ffffff' ? 'text-black' : 'text-white'
                        }`}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Size Selector */}
      {sizes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Size: <span className="font-normal text-neutral-600">{selectedSize}</span>
            </label>
            <Link
              href="/size-guide"
              className="hover:text-primary text-xs text-neutral-500 underline underline-offset-4"
            >
              Size Guide
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const isSelected = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`flex h-10 min-w-12 items-center justify-center rounded-md border px-3 text-xs font-medium uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground font-semibold'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity Selector + Add to Cart */}
      <div className="mb-6 flex gap-3">
        {/* Quantity Controls */}
        <div className="flex h-12 w-28 items-center justify-between rounded-md border border-neutral-300 bg-white px-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isOutOfStock}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold text-neutral-900">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            disabled={isOutOfStock}
            className="flex h-7 w-7 items-center justify-center rounded text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Add to Cart Button */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={isOutOfStock || isAdding}
          className="bg-primary text-primary-foreground flex h-12 flex-1 items-center justify-center rounded-md px-6 text-sm font-semibold uppercase tracking-wider transition-all hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
        >
          {isAdding ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : addedSuccess ? (
            <span className="flex items-center gap-1.5 text-xs text-white">
              <Check className="h-4 w-4" /> Added to Bag
            </span>
          ) : isOutOfStock ? (
            'Out of Stock'
          ) : (
            'Add to Cart'
          )}
        </button>

        {/* Wishlist Button with micro-interaction */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          onClick={() =>
            toggleItem({
              productId: product.id,
              slug: product.slug,
              name: product.name,
              basePriceCents: product.base_price_cents,
              compareAtPriceCents: product.compare_at_price_cents,
              imageUrl: primaryImageUrl,
            })
          }
          className={`flex h-12 w-12 items-center justify-center rounded-md border transition-all ${
            isWishlisted
              ? 'border-destructive text-destructive bg-red-50'
              : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
          }`}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <motion.div
            animate={isWishlisted ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
          </motion.div>
        </motion.button>
      </div>

      {/* Assurance badges */}
      <div className="mt-auto space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/50 p-4 text-xs text-neutral-600">
        <div className="flex items-center gap-2.5">
          <Truck className="h-4 w-4 text-neutral-800" />
          <span>Free US standard shipping on orders over $75</span>
        </div>
        <div className="flex items-center gap-2.5">
          <RotateCcw className="h-4 w-4 text-neutral-800" />
          <span>30-day hassle-free returns & exchanges</span>
        </div>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-neutral-800" />
          <span>Sustainably and ethically manufactured</span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

import { FREE_SHIPPING_THRESHOLD_CENTS } from '@repo/shared/constants';
import { formatUSD } from '@repo/shared/utils';

import { useCartStore } from '@/lib/store';

export function CartDrawer(): React.JSX.Element | null {
  const { items, isOpen, closeCart, updateQuantity, removeItem, getSubtotalCents, getTotalItems } =
    useCartStore();

  const totalItems = getTotalItems();
  const subtotalCents = getSubtotalCents();
  const subtotal = subtotalCents / 100;

  // Free shipping progress calculation ($75 threshold)
  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD_CENTS / 100;
  const amountToFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingPercent = Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100));

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeCart]);

  const drawerVariants = {
    hidden: { x: '100%', transition: { ease: [0.16, 1, 0.3, 1], duration: 0.3 } },
    visible: { x: '0%', transition: { ease: [0.16, 1, 0.3, 1], duration: 0.35 } },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Cart Drawer"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-neutral-700" />
                <h2 className="font-display text-primary text-lg font-bold">Bag ({totalItems})</h2>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Close cart"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Free Shipping Banner */}
            <div className="border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-xs">
              {amountToFreeShipping > 0 ? (
                <p className="text-neutral-600">
                  Add{' '}
                  <span className="text-primary font-semibold">
                    {formatUSD(amountToFreeShipping)}
                  </span>{' '}
                  more for Free US Standard Shipping
                </p>
              ) : (
                <p className="font-semibold text-emerald-600">
                  🎉 You unlocked Free Standard Shipping!
                </p>
              )}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${freeShippingPercent}%` }}
                />
              </div>
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <ShoppingBag className="h-12 w-12 text-neutral-300" />
                  <p className="font-display mt-4 text-base font-medium text-neutral-900">
                    Your bag is empty
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Discover our curated apparel and accessories.
                  </p>
                  <Link
                    href="/shop"
                    onClick={closeCart}
                    className="bg-primary text-primary-foreground mt-6 rounded-md px-6 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <li key={item.variantId} className="flex gap-4 py-4">
                      {/* Thumbnail */}
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-neutral-100">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>

                      {/* Details */}
                      <div className="flex min-w-0 flex-1 flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between">
                            <Link
                              href={`/product/${item.productSlug}`}
                              onClick={closeCart}
                              className="hover:text-primary truncate text-sm font-medium text-neutral-900"
                            >
                              {item.productName}
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeItem(item.variantId)}
                              className="hover:text-destructive ml-2 text-neutral-400"
                              aria-label={`Remove ${item.productName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {item.size ? `Size: ${item.size}` : ''}
                            {item.size && item.colorName ? ' · ' : ''}
                            {item.colorName ? `Color: ${item.colorName}` : ''}
                          </p>
                        </div>

                        {/* Quantity & Price */}
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center rounded border border-neutral-200 bg-white">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                              className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:bg-neutral-100"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold text-neutral-900">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                              className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:bg-neutral-100"
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <span className="text-sm font-semibold text-neutral-900">
                            {formatUSD((item.priceCents * item.quantity) / 100)}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer / Summary */}
            {items.length > 0 && (
              <div className="border-t border-neutral-200 bg-neutral-50/50 p-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-semibold text-neutral-900">{formatUSD(subtotal)}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  Taxes and shipping calculated at checkout.
                </p>

                <div className="mt-4 space-y-2">
                  <Link
                    href="/checkout"
                    onClick={closeCart}
                    className="bg-primary text-primary-foreground flex h-12 w-full items-center justify-center rounded-md text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-neutral-800"
                  >
                    Checkout · {formatUSD(subtotal)}
                  </Link>
                  <Link
                    href="/cart"
                    onClick={closeCart}
                    className="flex h-10 w-full items-center justify-center rounded-md border border-neutral-300 bg-white text-xs font-semibold uppercase tracking-wider text-neutral-800 transition-colors hover:bg-neutral-50"
                  >
                    View Full Bag
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatUSD } from '@repo/shared/utils';

import type { Product, ProductImage } from '@repo/shared/types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps): React.JSX.Element | null {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResults([]);
      setImages([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setImages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products || []);
          setImages(data.images || []);
        }
      } catch {
        // Search error fallback
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search catalog"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl"
          >
            {/* Search Input Bar */}
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center border-b border-neutral-200 px-4"
            >
              <Search className="h-5 w-5 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, essentials, categories..."
                className="h-14 w-full bg-transparent px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none"
              />
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              ) : query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded p-1 text-neutral-400 hover:text-neutral-600"
                  aria-label="Clear query"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </form>

            {/* Results / Suggestions Dropdown */}
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {query.trim() === '' ? (
                <div className="py-6 text-center text-xs text-neutral-400">
                  Type to search products or press{' '}
                  <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">
                    ESC
                  </kbd>{' '}
                  to close.
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    Products
                  </div>
                  <ul className="space-y-2">
                    {results.map((product) => {
                      const image = images.find(
                        (img) => img.product_id === product.id && img.is_primary,
                      );
                      return (
                        <li key={product.id}>
                          <Link
                            href={`/product/${product.slug}`}
                            onClick={onClose}
                            className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-50"
                          >
                            <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded bg-neutral-100">
                              {image ? (
                                <Image
                                  src={image.url}
                                  alt={image.alt_text ?? product.name}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-neutral-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-neutral-500">
                                {formatUSD(product.base_price_cents / 100)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {/* View all results button */}
                  <div className="border-t border-neutral-100 pt-3">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="text-primary w-full text-center text-xs font-medium hover:underline"
                    >
                      View all results for &ldquo;{query}&rdquo; →
                    </button>
                  </div>
                </div>
              ) : !isLoading ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium text-neutral-900">No results found</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    We couldn&apos;t find anything matching &ldquo;{query}&rdquo;.
                  </p>
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

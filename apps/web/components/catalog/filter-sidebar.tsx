'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { Category } from '@repo/shared/types';

interface FilterSidebarProps {
  categories?: Category[];
  activeCategorySlug?: string;
}

const PRICE_RANGES = [
  { label: 'All Prices', value: '' },
  { label: 'Under $50', value: '0-5000' },
  { label: '$50 to $100', value: '5000-10000' },
  { label: 'Over $100', value: '10000-999999' },
] as const;

export function FilterSidebar({
  categories = [],
  activeCategorySlug,
}: FilterSidebarProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  const currentPrice = searchParams.get('price') ?? '';

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearAllFilters = () => {
    const params = new URLSearchParams();
    const sort = searchParams.get('sort');
    if (sort) params.set('sort', sort);
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(currentPrice);

  const filterContent = (
    <div className="space-y-6">
      {/* Category List */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
            Categories
          </h3>
          <ul className="mt-3 space-y-2">
            {categories.map((cat) => {
              const isSelected = activeCategorySlug === cat.slug;
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/category/${cat.slug}`)}
                    className={`text-sm transition-colors ${
                      isSelected
                        ? 'text-primary font-semibold'
                        : 'hover:text-primary text-neutral-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Price Range */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
          Price Range
        </h3>
        <div className="mt-3 space-y-2">
          {PRICE_RANGES.map((range) => {
            const isChecked = currentPrice === range.value;
            return (
              <label
                key={range.label}
                className="hover:text-primary flex cursor-pointer items-center gap-2 text-sm text-neutral-600"
              >
                <input
                  type="radio"
                  name="price"
                  value={range.value}
                  checked={isChecked}
                  onChange={() => setFilter('price', range.value)}
                  className="text-primary focus:ring-primary h-4 w-4 border-neutral-300"
                />
                <span>{range.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Reset Filter Button */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="text-destructive text-xs font-medium underline-offset-4 hover:underline"
        >
          Reset Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile filter toggle button */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter & Refine
        </button>
      </div>

      {/* Mobile filter slide-over */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMobileFiltersOpen(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h2 className="font-display text-primary text-lg font-bold">Filters</h2>
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 overflow-y-auto">{filterContent}</div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">{filterContent}</aside>
    </>
  );
}

'use client';

import { ArrowLeft, Check, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import { StockAdjuster } from '@/components/admin/stock-adjuster';

import type { ProductVariant, ProductWithDetails } from '@repo/shared/types';

interface ProductEditFormProps {
  product: ProductWithDetails;
}


export function ProductEditForm({ product }: ProductEditFormProps): React.JSX.Element {
  const router = useRouter();

  // Form states
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug);
  const [categoryId, setCategoryId] = useState(product.category_id || '');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [basePrice, setBasePrice] = useState((product.base_price_cents / 100).toFixed(2));
  const [compareAtPrice, setCompareAtPrice] = useState(
    product.compare_at_price_cents ? (product.compare_at_price_cents / 100).toFixed(2) : '',
  );
  const [description, setDescription] = useState(product.description || '');
  const [tags, setTags] = useState((product.tags || []).join(', '));
  const [isActive, setIsActive] = useState(product.is_active);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load categories:', err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      const parsedBasePrice = parseFloat(basePrice);
      if (isNaN(parsedBasePrice) || parsedBasePrice <= 0) {
        throw new Error('Base price must be a valid positive number');
      }

      const basePriceCents = Math.round(parsedBasePrice * 100);
      const compareAtPriceCents = compareAtPrice
        ? Math.round(parseFloat(compareAtPrice) * 100)
        : null;

      const parsedTags = tags
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);


      const payload = {
        name,
        slug,
        categoryId: categoryId || null,
        basePriceCents,
        compareAtPriceCents,
        isActive,
        isFeatured,
        description: description || null,
        tags: parsedTags,
      };

      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update product');
      }

      setSaveSuccess(true);
      router.refresh();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/products"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Products Catalog
          </Link>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Edit: {name}</h2>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            Slug: /{slug} • ID: {product.id}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="shadow-2xs rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            View on Storefront ↗
          </Link>
        </div>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <Check className="h-4 w-4 text-emerald-600" />
          Product successfully updated!
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="shadow-xs space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900">
            Product Attributes
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Product Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Slug</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
              >
                <option value="">Select Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">
                Base Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs focus:border-zinc-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">
                Compare At Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs focus:border-zinc-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-zinc-700">Status</label>
              <select
                value={isActive ? 'true' : 'false'}
                onChange={(e) => setIsActive(e.target.value === 'true')}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
              >
                <option value="true">Active (Published)</option>
                <option value="false">Draft (Inactive)</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-700">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                Mark as Featured Product
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
              placeholder="Product summary and material notes..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-700">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="cotton, casual, essential"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs focus:border-zinc-900 focus:outline-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Product Variants Matrix */}
      <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Assigned Variants ({product.variants.length})
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Live warehouse stock levels for this apparel style
            </p>
          </div>
        </div>

        {product.variants.length === 0 ? (
          <p className="text-xs text-zinc-500">No variants configured for this product.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {product.variants.map((v: ProductVariant) => (
              <div
                key={v.id}
                className="flex flex-col gap-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-mono font-semibold text-zinc-900">{v.sku}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">
                    Size: <span className="font-bold text-zinc-700">{v.size || 'N/A'}</span> • Color:{' '}
                    <span className="font-bold text-zinc-700">{v.color_name || 'N/A'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <StockAdjuster
                    variantId={v.id}
                    initialStock={v.inventory_count}
                    lowStockThreshold={v.low_stock_threshold}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

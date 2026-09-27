'use client';

import { ArrowLeft, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

import type { SizeEnum } from '@repo/shared/types';

interface VariantDraft {
  sku: string;
  size: SizeEnum;
  colorName: string;
  inventoryCount: number;
}

export default function AdminNewProductPage(): React.JSX.Element {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const [basePrice, setBasePrice] = useState('68.00');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [variants, setVariants] = useState<VariantDraft[]>([
    { sku: 'ROOT-01-BLK-M', size: 'M', colorName: 'Obsidian Black', inventoryCount: 50 },
    { sku: 'ROOT-01-BLK-L', size: 'L', colorName: 'Obsidian Black', inventoryCount: 45 },
  ]);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Auto-generate slug from name
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  }, [name]);

  const addVariant = (): void => {
    const sizeOptions: SizeEnum[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const nextSize = sizeOptions[variants.length % sizeOptions.length] || 'M';
    setVariants((prev) => [
      ...prev,
      {
        sku: `${slug || 'PROD'}-${nextSize}-${prev.length + 1}`.toUpperCase(),
        size: nextSize,
        colorName: 'Standard',
        inventoryCount: 25,
      },
    ]);
  };

  const removeVariant = (index: number): void => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (
    index: number,
    field: keyof VariantDraft,
    value: string | number,
  ): void => {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const basePriceCents = Math.round(parseFloat(basePrice) * 100);
      const compareAtPriceCents = compareAtPrice
        ? Math.round(parseFloat(compareAtPrice) * 100)
        : null;

      const payload = {
        name,
        slug,
        categoryId: categoryId || null,
        basePriceCents,
        compareAtPriceCents,
        description,
        isActive: true,
        tags: ['New Arrival'],
        variants: variants.map((v) => ({
          sku: v.sku,
          size: v.size,
          colorName: v.colorName,
          inventoryCount: v.inventoryCount,
          lowStockThreshold: 5,
        })),
        images: imageUrl
          ? [
              {
                url: imageUrl,
                altText: name,
                isPrimary: true,
                sortOrder: 0,
              },
            ]
          : [],
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        router.push('/admin/products');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to create product');
      }
    } catch {
      setErrorMsg('Network error while saving product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/products"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Products Catalog
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Add New Apparel Item</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Create product specifications, price tiers, and inventory variants.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Core Product Information */}
        <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
          <h3 className="border-b border-zinc-100 pb-3 text-sm font-semibold text-zinc-900">
            Product Essentials
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Product Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Minimalist Heavyweight Tee"
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                URL Slug *
              </label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="minimalist-heavyweight-tee"
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs text-zinc-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Base Price ($ USD) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="68.00"
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
                Compare-at Price ($ USD)
              </label>
              <input
                type="number"
                step="0.01"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                placeholder="88.00"
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-zinc-700">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-700 focus:bg-white"
              >
                <option value="">Select Category (Optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
              Short Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Crafted from premium 280 GSM combed organic cotton with relaxed drop-shoulder cut..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-xs focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-zinc-700">
              Primary Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 font-mono text-xs text-zinc-600 focus:bg-white"
            />
          </div>
        </div>

        {/* Variants Section */}
        <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Inventory Variants</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Sizes, colors, and initial warehouse stock
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Variant
            </button>
          </div>

          <div className="space-y-3">
            {variants.map((v, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-4"
              >
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                    SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={v.sku}
                    onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white p-2 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                    Size
                  </label>
                  <select
                    value={v.size}
                    onChange={(e) => updateVariant(idx, 'size', e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white p-2 text-xs"
                  >
                    {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                    Color Name
                  </label>
                  <input
                    type="text"
                    required
                    value={v.colorName}
                    onChange={(e) => updateVariant(idx, 'colorName', e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white p-2 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-500">
                      Stock Qty
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={v.inventoryCount}
                      onChange={(e) =>
                        updateVariant(idx, 'inventoryCount', parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full rounded-md border border-zinc-200 bg-white p-2 font-mono text-xs"
                    />
                  </div>
                  {variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeVariant(idx)}
                      className="p-2 text-zinc-400 transition-colors hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
          <Link
            href="/admin/products"
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="shadow-xs inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Publish Product
          </button>
        </div>
      </form>
    </div>
  );
}

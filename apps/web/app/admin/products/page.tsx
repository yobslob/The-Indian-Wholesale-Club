import { PackagePlus, Search, Shirt } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { getAdminCategories, getAdminProducts } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    page?: string;
  }>;
}

export default async function AdminProductsPage({
  searchParams,
}: ProductsPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || '';
  const categoryId = resolvedParams.categoryId || 'all';
  const page = parseInt(resolvedParams.page || '1', 10);

  const [productsData, categories] = await Promise.all([
    getAdminProducts({
      search: search || undefined,
      categoryId: categoryId !== 'all' ? categoryId : undefined,
      page,
      limit: 20,
    }),
    getAdminCategories(),
  ]);

  const { products, totalCount, totalPages } = productsData;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Product Catalog</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Manage core apparel inventory, pricing, variants, and product visibility.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="shadow-xs inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
        >
          <PackagePlus className="h-4 w-4" />
          Add New Product
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="shadow-xs flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row">
        <form
          method="GET"
          action="/admin/products"
          className="flex w-full flex-1 items-center gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search products by title or slug..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs text-zinc-900 focus:bg-white"
            />
          </div>

          <select
            name="categoryId"
            defaultValue={categoryId}
            className="focus:outline-hidden rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 focus:bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Product Catalog Table */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Base Price</th>
                <th className="px-4 py-3">Variants</th>
                <th className="px-4 py-3">Total Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Shirt className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    No products found matching query.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                          {product.primaryImageUrl ? (
                            <Image
                              src={product.primaryImageUrl}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-400">
                              <Shirt className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">{product.name}</div>
                          <div className="font-mono text-[11px] text-zinc-400">/{product.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-600">
                      {product.categoryName || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                      ${(product.base_price_cents / 100).toFixed(2)}
                      {product.compare_at_price_cents && (
                        <span className="ml-1.5 text-[11px] text-zinc-400 line-through">
                          ${(product.compare_at_price_cents / 100).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-600">
                      {product.variantCount} options
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                      {product.totalStock} units
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          product.is_active
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-zinc-200 bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {product.is_active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="inline-flex items-center rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 p-4 text-xs text-zinc-500">
            <div>
              Showing {products.length} of {totalCount} items
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/products?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/products?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

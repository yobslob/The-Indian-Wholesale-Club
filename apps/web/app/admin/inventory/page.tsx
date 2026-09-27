import { AlertTriangle, Boxes, CheckCircle2, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

import { StockAdjuster } from '@/components/admin';
import { getAdminInventory } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';

interface InventoryPageProps {
  searchParams: Promise<{
    search?: string;
    lowStockOnly?: string;
    page?: string;
  }>;
}

export default async function AdminInventoryPage({
  searchParams,
}: InventoryPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || '';
  const lowStockOnly = resolvedParams.lowStockOnly === 'true';
  const page = parseInt(resolvedParams.page || '1', 10);

  const { inventory, totalCount, totalPages, totalUnits, lowStockTotal } =
    await getAdminInventory({
      search: search || undefined,
      lowStockOnly,
      page,
      limit: 25,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Inventory Matrix</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Real-time SKU-level inventory tracking and inline stock adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="shadow-2xs flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs">
            <span className="text-zinc-500">Tracked SKUs:</span>
            <span className="font-mono font-bold text-zinc-900">{totalCount}</span>
          </div>
          <div className="shadow-2xs flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs">
            <span className="text-zinc-500">Total Units:</span>
            <span className="font-mono font-bold text-zinc-900">{totalUnits}</span>
          </div>
          <div className="shadow-2xs flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <span className="font-semibold">Low Stock:</span>
            <span className="font-mono font-bold">{lowStockTotal}</span>
          </div>
        </div>
      </div>


      {/* Filter Bar */}
      <div className="shadow-xs flex flex-col items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row">
        <form
          method="GET"
          action="/admin/inventory"
          className="flex w-full flex-1 items-center gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by SKU (e.g. ROOT-...) or color name..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs text-zinc-900 focus:bg-white"
            />
          </div>

          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Search
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/inventory?lowStockOnly=${!lowStockOnly}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              lowStockOnly
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock'}
          </Link>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock Level (Inline Adjust)</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    <Boxes className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    No variant inventory found matching criteria.
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.variantId} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
                          {item.primaryImageUrl ? (
                            <Image
                              src={item.primaryImageUrl}
                              alt={item.productName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-zinc-400">
                              <Boxes className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="font-semibold text-zinc-900">{item.productName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-zinc-700">{item.sku}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900">{item.size || 'OS'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {item.colorHex && (
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-zinc-300"
                            style={{ backgroundColor: item.colorHex }}
                          />
                        )}
                        <span className="text-zinc-600">{item.colorName || 'Default'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-zinc-900">
                      ${(item.priceCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <StockAdjuster
                        variantId={item.variantId}
                        initialStock={item.inventoryCount}
                        lowStockThreshold={item.lowStockThreshold}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.isOutOfStock ? (
                        <span className="text-[10px] font-bold uppercase text-rose-600">
                          Out of Stock
                        </span>
                      ) : item.isLowStock ? (
                        <span className="text-[10px] font-bold uppercase text-amber-600">
                          Low (≤ {item.lowStockThreshold})
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Healthy
                        </span>
                      )}
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
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/inventory?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${lowStockOnly ? '&lowStockOnly=true' : ''}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/inventory?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}${lowStockOnly ? '&lowStockOnly=true' : ''}`}
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

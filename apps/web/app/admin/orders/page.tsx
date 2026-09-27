import { Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { StatusBadge } from '@/components/admin';
import { getAdminOrders } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';

interface OrdersPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminOrdersPage({
  searchParams,
}: OrdersPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || '';
  const status = resolvedParams.status || 'all';
  const page = parseInt(resolvedParams.page || '1', 10);

  const { orders, totalCount, totalPages } = await getAdminOrders({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    page,
    limit: 15,
  });

  const STATUS_TABS = [
    { label: 'All Orders', value: 'all' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Processing', value: 'processing' },
    { label: 'In Transit', value: 'in_transit' },
    { label: 'Delivered', value: 'delivered' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Order Management</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Track and fulfill customer orders across all payment and transit states.
          </p>
        </div>
        <div className="shadow-2xs rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
          Total: <span className="font-bold text-zinc-900">{totalCount}</span> orders
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-3">
          {STATUS_TABS.map((tab) => {
            const isSelected = status === tab.value;
            return (
              <Link
                key={tab.value}
                href={`/admin/orders?status=${tab.value}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? 'shadow-2xs bg-zinc-900 font-semibold text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form method="GET" action="/admin/orders" className="flex items-center gap-3">
          <input type="hidden" name="status" value={status} />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by order number (ORD-...), customer name, or email..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Filter
          </button>
          {search && (
            <Link
              href={`/admin/orders?status=${status}`}
              className="px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Orders Table */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Fulfillment</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-400">
                    <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    No orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-zinc-900">{order.customerName}</div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        {order.customerEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-zinc-600">
                      {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                      ${(order.total_cents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.payment_status} type="payment" />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 p-4 text-xs text-zinc-500">
            <div>
              Page <span className="font-bold text-zinc-900">{page}</span> of{' '}
              <span className="font-bold text-zinc-900">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/orders?status=${status}&page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/orders?status=${status}&page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
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

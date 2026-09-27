import { Mail, Search, Users } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { getAdminCustomers } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';

interface CustomersPageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function AdminCustomersPage({
  searchParams,
}: CustomersPageProps): Promise<React.JSX.Element> {
  const resolvedParams = await searchParams;
  const search = resolvedParams.search || '';
  const page = parseInt(resolvedParams.page || '1', 10);

  const { customers, totalCount, totalPages } = await getAdminCustomers({
    search: search || undefined,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Customer Directory</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Registered customer accounts, purchasing volume, and lifetime value.
          </p>
        </div>
        <div className="shadow-2xs rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600">
          Total Customers: <span className="font-bold text-zinc-900">{totalCount}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="shadow-xs flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <form method="GET" action="/admin/customers" className="flex flex-1 items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by customer name or email..."
              className="focus:outline-hidden w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-xs text-zinc-900 focus:bg-white"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Search
          </button>
        </form>
      </div>

      {/* Customer Directory Table */}
      <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Member Since</th>
                <th className="px-4 py-3">Total Orders</th>
                <th className="px-4 py-3">Lifetime Spend</th>
                <th className="px-4 py-3">Last Activity</th>
                <th className="px-4 py-3 text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-400">
                    <Users className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
                    No registered customers found.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-zinc-50/70">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
                          {(c.fullName || c.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900">
                            {c.fullName || 'Anonymous Customer'}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-400">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500">
                      {new Date(c.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-800">
                      {c.orderCount} orders
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-zinc-900">
                      ${(c.totalSpentCents / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500">
                      {c.lastOrderDate
                        ? new Date(c.lastOrderDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'No orders yet'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </a>
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
                  href={`/admin/customers?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/customers?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}
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

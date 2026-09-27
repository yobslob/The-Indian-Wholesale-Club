import { Package } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { formatUSD } from '@repo/shared/utils';

import { StatusBadge } from '@/components/admin/status-badge';
import { getOrders } from '@/lib/queries/account';
import { createClient } from '@/lib/supabase/server';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order History - ROOT',
  description: 'View and track your ROOT orders.',
  robots: { index: false },
};

export default async function AccountOrdersPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/account/orders');
  }

  const orders = await getOrders(supabase);

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-10 md:px-8 lg:px-12">
      <div className="border-b border-neutral-200 pb-6">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center space-x-2 text-xs text-neutral-500">
            <li>
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-neutral-400">/</span>
              <Link href="/account" className="hover:text-primary">
                Account
              </Link>
            </li>
            <li className="flex items-center space-x-2">
              <span className="text-neutral-400">/</span>
              <span className="font-medium text-neutral-900">Orders</span>
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-primary text-3xl font-bold tracking-tight md:text-4xl">
          Order History
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Every order placed with your account, newest first.
        </p>
      </div>

      <div className="mt-8">
        {orders.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
              <Package className="h-8 w-8 text-neutral-400" />
            </div>
            <h3 className="font-display text-primary mt-4 text-lg font-bold">No orders yet</h3>
            <p className="mt-1 text-sm text-neutral-500">
              When you place an order it will show up here.
            </p>
            <Link
              href="/"
              className="bg-primary text-primary-foreground mt-6 inline-block rounded-md px-6 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-neutral-800"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-900">
                      #{order.order_number}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                      {formatUSD(order.total_cents / 100)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/order-status/${order.id}`}
                        className="text-xs font-semibold uppercase tracking-wider text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                      >
                        Track
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  DollarSign,
  Package,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { RevenueChart, StatsCard, StatusBadge } from '@/components/admin';
import { getAdminDashboardStats, getAdminInventory, getAdminOrders } from '@/lib/queries/admin';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage(): Promise<React.JSX.Element> {
  const [stats, ordersData, inventoryData] = await Promise.all([
    getAdminDashboardStats(),
    getAdminOrders({ limit: 6 }),
    getAdminInventory({ lowStockOnly: true, limit: 5 }),
  ]);

  const recentOrders = ordersData.orders;
  const lowStockItems = inventoryData.inventory;

  return (
    <div className="space-y-8">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Operations & Logistics Overview
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Real-time fulfillment metrics and revenue tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/orders"
            className="shadow-2xs rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Manage Orders
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Revenue"
          value={`$${(stats.totalRevenueCents / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          change={`${stats.revenueChangePercentage}%`}
          isPositive={true}
          subtitle="vs previous cycle"
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
        />
        <StatsCard
          title="Total Orders"
          value={stats.totalOrders}
          change={`${stats.ordersChangePercentage}%`}
          isPositive={true}
          subtitle="lifetime volume"
          icon={<ShoppingBag className="h-5 w-5 text-blue-600" />}
        />
        <StatsCard
          title="Average Order Value"
          value={`$${(stats.averageOrderValueCents / 100).toFixed(2)}`}
          subtitle="net per order"
          icon={<Package className="h-5 w-5 text-indigo-600" />}
        />
        <StatsCard
          title="Pending Shipments"
          value={stats.pendingShipments}
          subtitle="in fulfillment queue"
          icon={<Boxes className="h-5 w-5 text-amber-600" />}
        />
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={stats.salesTrend} />

      {/* Recent Orders & Low Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Orders Table */}
        <div className="shadow-xs overflow-hidden rounded-xl border border-zinc-200 bg-white lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 p-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Recent Customer Orders</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Latest purchases requiring fulfillment</p>
            </div>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Fulfillment</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-400">
                      No customer orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-zinc-50/60">
                      <td className="px-4 py-3.5 font-mono font-semibold text-zinc-900">
                        {order.order_number}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-zinc-900">{order.customerName}</div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          {order.customerEmail}
                        </div>
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
                          className="font-semibold text-zinc-900 hover:underline"
                        >
                          Inspect →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="shadow-xs flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900">Low Stock Alerts</h3>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                {lowStockItems.length} items
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {lowStockItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  All catalog inventory levels healthy!
                </div>
              ) : (
                lowStockItems.map((item) => (
                  <div
                    key={item.variantId}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">{item.productName}</div>
                      <div className="font-mono text-[11px] text-zinc-500">
                        SKU: {item.sku} {item.size && `• ${item.size}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-rose-600">
                        {item.inventoryCount} left
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Limit: {item.lowStockThreshold}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            href="/admin/inventory"
            className="shadow-xs mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Open Inventory Matrix
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

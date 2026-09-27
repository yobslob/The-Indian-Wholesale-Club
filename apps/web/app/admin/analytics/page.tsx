import { BarChart3, CreditCard, DollarSign, Percent, ShoppingBag, TrendingUp } from 'lucide-react';
import React from 'react';

import { RevenueChart, StatsCard } from '@/components/admin';
import { getAdminDashboardStats } from '@/lib/queries/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface CategoryRow {
  total_price_cents: number;
  quantity: number;
  product_variants: {
    products: { name: string; categories: { name: string } | null } | null;
  } | null;
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function AdminAnalyticsPage(): Promise<React.JSX.Element> {
  const stats = await getAdminDashboardStats();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Real category + product performance over the past 30 days (C9)
  const [itemRows, totalOrdersRes, refundedOrdersRes] = await Promise.all([
    supabaseAdmin
      .from('order_items')
      .select('total_price_cents, quantity, product_variants(products(name, categories(name)))')
      .gte('created_at', thirtyDaysAgo)
      .limit(5000),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'refunded'),
  ]);

  const items = (itemRows.data ?? []) as unknown as CategoryRow[];

  const categoryMap = new Map<string, { revenueCents: number; itemsSold: number }>();
  const productMap = new Map<string, { revenueCents: number; units: number }>();

  for (const row of items) {
    const product = row.product_variants?.products ?? null;
    const categoryName = product?.categories?.name ?? 'Uncategorized';
    const productName = product?.name ?? 'Unknown product';

    const cat = categoryMap.get(categoryName) ?? { revenueCents: 0, itemsSold: 0 };
    cat.revenueCents += row.total_price_cents;
    cat.itemsSold += row.quantity;
    categoryMap.set(categoryName, cat);

    const prod = productMap.get(productName) ?? { revenueCents: 0, units: 0 };
    prod.revenueCents += row.total_price_cents;
    prod.units += row.quantity;
    productMap.set(productName, prod);
  }

  const categoryTotal = [...categoryMap.values()].reduce((sum, c) => sum + c.revenueCents, 0);
  const categoryBreakdown = [...categoryMap.entries()]
    .map(([name, data]) => ({
      name,
      revenueCents: data.revenueCents,
      itemsSold: data.itemsSold,
      percentage: categoryTotal > 0 ? Math.round((data.revenueCents / categoryTotal) * 100) : 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const topProducts = [...productMap.entries()]
    .map(([name, data]) => ({ name, sales: data.units, revenueCents: data.revenueCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  const totalOrders = totalOrdersRes.count ?? 0;
  const refundedOrders = refundedOrdersRes.count ?? 0;
  const refundRate = totalOrders > 0 ? (refundedOrders / totalOrders) * 100 : 0;

  const revenueChange = stats.revenueChangePercentage;
  const revenueLabel = `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% vs prior 7d`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
          Financial & Sales Analytics
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Revenue breakdowns and product velocity computed from live order data.
        </p>
        {stats.dataUnavailable && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Analytics are unavailable right now - showing zeroes rather than estimated figures.
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Gross Revenue (All Time)"
          value={formatMoney(stats.totalRevenueCents)}
          change={revenueLabel}
          isPositive={revenueChange >= 0}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
        />
        <StatsCard
          title="Average Order Value"
          value={formatMoney(stats.averageOrderValueCents)}
          subtitle="Paid orders"
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
        />
        <StatsCard
          title="Conversion Rate"
          value="Not tracked"
          subtitle="Analytics events not instrumented yet"
          icon={<Percent className="h-5 w-5 text-amber-600" />}
        />
        <StatsCard
          title="Refund Rate"
          value={`${refundRate.toFixed(1)}%`}
          isPositive={refundRate < 2}
          subtitle={`${refundedOrders} of ${totalOrders} orders`}
          icon={<CreditCard className="h-5 w-5 text-zinc-600" />}
        />
      </div>

      {/* Sales Trend Chart */}
      <RevenueChart data={stats.salesTrend} />

      {/* Category Breakdown & Top Products */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category Breakdown */}
        <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Revenue by Category
            </h3>
            <span className="text-xs text-zinc-400">Past 30 Days</span>
          </div>

          {categoryBreakdown.length > 0 ? (
            <div className="space-y-4">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-zinc-900">{cat.name}</span>
                    <span className="font-mono text-zinc-500">
                      {(cat.revenueCents / 100).toLocaleString()} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-900"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-zinc-400">
              No sales in the past 30 days yet.
            </p>
          )}
        </div>

        {/* Top Performing Products */}
        <div className="shadow-xs space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <ShoppingBag className="h-4 w-4 text-zinc-500" />
              Top Products by Revenue
            </h3>
            <span className="text-xs text-zinc-400">Past 30 Days</span>
          </div>

          {topProducts.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {topProducts.map((prod) => (
                <div key={prod.name} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <div className="font-semibold text-zinc-900">{prod.name}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-400">{prod.sales} units sold</div>
                  </div>
                  <div className="text-right font-mono font-bold text-zinc-900">
                    {(prod.revenueCents / 100).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-zinc-400">
              No sales in the past 30 days yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

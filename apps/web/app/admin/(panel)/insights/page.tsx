import Link from 'next/link';

import { getDemand, getSales, type Sales } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { Cell, Empty, PageTitle, rupees, SectionTitle, Table, Tabs } from '@/features/admin/ui';

type SearchParams = Promise<{ period?: string }>;

const PERIODS = [
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
] as const;

function SalesTable({ title, rows, shop }: { title: string; rows: Sales['by_region']; shop?: boolean }): React.JSX.Element {
  return (
    <section className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <Empty>No sales in this period.</Empty>
      ) : (
        <Table head={shop ? ['Shop', 'Pieces', 'Revenue', 'Paid to the shop'] : [title.replace('By ', ''), 'Pieces', 'Revenue']}>
          {rows.map((r) => (
            <tr key={r.name}>
              <Cell>{r.name}</Cell>
              <Cell>{r.pieces}</Cell>
              <Cell>{formatUsd(r.revenue_cents)}</Cell>
              {shop ? <Cell>{rupees(r.shop_cost_paise ?? 0)}</Cell> : null}
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

/**
 * Insights (admin.md): real numbers only, computed in SQL, never estimated or fabricated (C7). Sales by state, category
 * and shop; what customers search for, including searches that found nothing (what to list next), and what they save.
 * Revenue is the pieces' prices before tax and shipping, for paid orders that were not cancelled.
 */
export default async function InsightsPage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const wanted = (await searchParams).period;
  const period = PERIODS.find((p) => p.key === wanted) ?? PERIODS[0];
  const since = period.days === null ? null : new Date(Date.now() - period.days * 86_400_000);
  const [sales, demand] = await Promise.all([getSales(client, since), getDemand(client, since)]);

  return (
    <div className="space-y-8">
      <PageTitle>Insights</PageTitle>
      <Tabs
        items={PERIODS.map((p) => ({ key: p.key, label: p.label, href: `/admin/insights?period=${p.key}` }))}
        current={period.key}
      />
      <p>
        <strong>{sales.totals.orders}</strong> orders · <strong>{sales.totals.pieces}</strong> pieces ·{' '}
        <strong>{formatUsd(sales.totals.revenue_cents)}</strong> in pieces sold (before tax and shipping)
      </p>
      <div className="grid gap-8 lg:grid-cols-2">
        <SalesTable title="By state" rows={sales.by_region} />
        <SalesTable title="By category" rows={sales.by_category} />
      </div>
      <SalesTable title="By shop" rows={sales.by_shop} shop />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-2">
          <SectionTitle>Searched for, found nothing</SectionTitle>
          <p className="text-ink-muted text-sm">What customers wanted and the store didn&apos;t have: ideas for the next listings.</p>
          {demand.empty_searches.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <Table head={['Search', 'Times']}>
              {demand.empty_searches.map((s) => (
                <tr key={s.query}>
                  <Cell>{s.query}</Cell>
                  <Cell>{s.count}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </section>
        <section className="space-y-2">
          <SectionTitle>Top searches</SectionTitle>
          {demand.top_searches.length === 0 ? (
            <Empty>No searches yet.</Empty>
          ) : (
            <Table head={['Search', 'Times', 'Pieces found (last time)']}>
              {demand.top_searches.map((s) => (
                <tr key={s.query}>
                  <Cell>{s.query}</Cell>
                  <Cell>{s.count}</Cell>
                  <Cell>{s.last_results}</Cell>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>

      <section className="space-y-2">
        <SectionTitle>Most saved</SectionTitle>
        {demand.most_saved.length === 0 ? (
          <Empty>Nobody has saved a piece in this period.</Empty>
        ) : (
          <Table head={['Piece', 'State', 'Status', 'Saved by', 'Pieces left']}>
            {demand.most_saved.map((p) => (
              <tr key={p.id}>
                <Cell>
                  <Link href={`/admin/catalog/${p.id}`} className="underline">
                    {p.name}
                  </Link>
                </Cell>
                <Cell>{p.region}</Cell>
                <Cell>{p.status}</Cell>
                <Cell>{p.saves}</Cell>
                <Cell className={p.available === 0 ? 'text-caution' : ''}>{p.available}</Cell>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}

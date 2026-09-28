import { salesByRegion } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { Cell, Empty, PageTitle, Table } from '@/features/admin/ui';

/** Insights: real sales only, never estimated or fabricated (admin.md). More views come in the coding phase. */
export default async function InsightsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const rows = await salesByRegion(client);
  return (
    <div className="space-y-4">
      <PageTitle>Insights</PageTitle>
      <h2 className="font-medium">Sales by region (paid orders)</h2>
      {rows.length === 0 ? (
        <Empty>No sales yet.</Empty>
      ) : (
        <Table head={['Region', 'Pieces', 'Revenue']}>
          {rows.map((r) => (
            <tr key={r.regionName}>
              <Cell>{r.regionName}</Cell>
              <Cell>{r.pieces}</Cell>
              <Cell>{formatUsd(r.revenueCents)}</Cell>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

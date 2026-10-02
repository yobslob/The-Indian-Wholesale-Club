import Link from 'next/link';
import { notFound } from 'next/navigation';

import { listCycleExportLines, listCycles } from '@repo/db/admin';

import { invoiceRows, packingListRows, type Row } from '@/features/admin/export-documents';
import { requireAdminPage } from '@/features/admin/guard';
import { PageTitle } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

function Sheet({ rows }: { rows: Row[] }): React.JSX.Element {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-line border-b">
            {row.map((cell, j) => (
              <td key={j} className="px-2 py-1 align-top">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The export's packing list and commercial invoice (flows.md §6.1), to print or save as PDF from the browser, or
 * download as CSV. Built from the cycle's picked pieces; the invoice's undecided fields stay marked (Q-30).
 */
export default async function CycleDocumentsPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [cycles, lines] = await Promise.all([listCycles(client, 100), listCycleExportLines(client, id)]);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) notFound();

  return (
    <div className="space-y-8">
      <PageTitle>Export documents · {cycle.code}</PageTitle>
      <p className="text-ink-muted print:hidden">
        {lines.length} picked piece lines. Print this page (or save it as PDF), or download{' '}
        <Link href={`/admin/cycles/${id}/csv/packing-list`} className="underline" prefetch={false}>
          the packing list
        </Link>{' '}
        and{' '}
        <Link href={`/admin/cycles/${id}/csv/invoice`} className="underline" prefetch={false}>
          the invoice
        </Link>{' '}
        as CSV.
      </p>
      <section className="space-y-2 break-after-page">
        <h2 className="font-medium">Packing list</h2>
        <Sheet rows={packingListRows(lines)} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Commercial invoice (goods)</h2>
        <p className="text-caution text-sm">
          Exporter, consignee, HS codes, the value to declare and Incoterms are not decided yet (Q-30).
        </p>
        <Sheet rows={invoiceRows(lines, cycle.fx_inr_per_usd)} />
      </section>
    </div>
  );
}

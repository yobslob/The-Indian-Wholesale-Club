import { notFound } from 'next/navigation';

import { listBusinessDetails, listCycleExportLines, listCycles } from '@repo/db/admin';

import { detailsByKey, invoiceRows, packingListRows, toCsv } from '@/features/admin/export-documents';
import { adminAccess } from '@/features/admin/guard';

type Params = Promise<{ id: string; doc: string }>;

/**
 * /admin/cycles/<id>/csv/packing-list and …/csv/invoice (flows.md §6.1): the export's documents as CSV for a
 * spreadsheet or the forwarder. Admin only: anyone else gets the same 404 as any unknown page (D-006).
 */
export async function GET(_request: Request, { params }: { params: Params }): Promise<Response> {
  const access = await adminAccess();
  if (access.state !== 'admin') notFound();
  const { id, doc } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !['packing-list', 'invoice'].includes(doc)) notFound();

  const [cycles, lines, details] = await Promise.all([
    listCycles(access.client, 100),
    listCycleExportLines(access.client, id),
    doc === 'invoice' ? listBusinessDetails(access.client) : [],
  ]);
  const cycle = cycles.find((c) => c.id === id);
  if (!cycle) notFound();
  const rows =
    doc === 'invoice' ? invoiceRows(lines, cycle.fx_inr_per_usd, detailsByKey(details)) : packingListRows(lines);
  // A byte-order mark so spreadsheet apps read ₹ and other non-ASCII text as UTF-8.
  return new Response(String.fromCharCode(0xfeff) + toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${cycle.code}-${doc}.csv"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

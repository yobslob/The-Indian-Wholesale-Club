import { notFound } from 'next/navigation';

import { listPriceSheet } from '@repo/db/admin';

import { adminAccess } from '@/features/admin/guard';
import { PRICE_SHEET_COLUMNS, priceSheetRows } from '@/features/admin/price-sheet';
import { buildXlsx } from '@/features/admin/xlsx';

const STATUSES = ['draft', 'live', 'paused', 'archived'] as const;
type Status = (typeof STATUSES)[number];

/**
 * /admin/catalog/export (D-128): Products → Download Excel, the six columns (name, Indian price, category, weight, US
 * price, margin) for the page's view: ?status=, ?us=1, ?q= as on Products. Admin only: anyone else gets the same 404 as
 * any unknown page (D-006).
 */
export async function GET(request: Request): Promise<Response> {
  const access = await adminAccess();
  if (access.state !== 'admin') notFound();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const rows = await listPriceSheet(access.client, {
    status: STATUSES.includes(status as Status) ? (status as Status) : undefined,
    usStock: url.searchParams.get('us') === '1',
    search: url.searchParams.get('q')?.slice(0, 100),
  });
  const xlsx = buildXlsx('IWC prices', PRICE_SHEET_COLUMNS, priceSheetRows(rows));
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Blob([xlsx as Uint8Array<ArrayBuffer>]), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="iwc-prices-${status ?? 'all'}-${day}.xlsx"`,
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

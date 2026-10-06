import Link from 'next/link';

import { listReturns, RETURN_STATUSES, type ReturnStatus } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { returnReceivedAction, returnRefundAction, returnRejectAction } from '@/features/admin/actions/after-sales';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Cell, Empty, input, PageTitle, Table, Tabs, utc } from '@/features/admin/ui';

type SearchParams = Promise<{ status?: string }>;

const REASON: Record<string, string> = {
  damaged: 'Damaged (check the handover photos)',
  wrong: 'Wrong piece',
  changed_mind: 'Changed their mind',
};

/**
 * Returns (D-071), oldest first. The refund was fixed by the rule when the customer asked: a damage or mistake claim
 * gets everything back, a change of mind keeps the tier's share. Book a courier pickup from the customer's door (D-076); when
 * it arrives, mark it received (it becomes a US clearance draft, D-072), then refund (Stripe first). Or reject it.
 */
export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const requested = (await searchParams).status;
  const status: ReturnStatus = RETURN_STATUSES.find((s) => s === requested) ?? 'requested';
  const rows = await listReturns(client, status);

  return (
    <div className="space-y-4">
      <PageTitle>Returns</PageTitle>
      <Tabs
        items={RETURN_STATUSES.map((s) => ({ key: s, href: `/admin/returns?status=${s}`, label: s[0]!.toUpperCase() + s.slice(1) }))}
        current={status}
      />
      {status === 'requested' ? (
        <p className="text-ink-muted text-sm">
          Book a courier to collect each piece from the customer's door (handover photos, as at delivery, D-076). Mark it
          received once it is at the US warehouse.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        <Table head={['Asked', 'Order', 'Piece', 'Reason', 'Refund', 'Next']}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Cell>{utc(r.requested_at)}</Cell>
              <Cell>
                {r.order ? (
                  <Link href={`/admin/orders/${r.order.id}`} className="underline">
                    {r.order.order_number}
                  </Link>
                ) : null}
                <span className="text-ink-muted block text-xs">{r.order?.email}</span>
              </Cell>
              <Cell>
                {r.item ? `${r.item.product_name} (${r.item.variant_label}) · ${r.item.region_name}` : '—'}
              </Cell>
              <Cell>{REASON[r.reason] ?? r.reason}</Cell>
              <Cell>
                {formatUsd(r.refund_cents)}
                {Number(r.kept_pct) > 0 ? <span className="text-ink-muted block text-xs">{Number(r.kept_pct)}% kept</span> : null}
              </Cell>
              <Cell>
                {r.status === 'requested' ? (
                  <form action={returnReceivedAction.bind(null, r.id)}>
                    <button type="submit" className={button}>
                      Received
                    </button>
                  </form>
                ) : null}
                {r.status === 'received' ? (
                  <form action={returnRefundAction.bind(null, r.id)}>
                    <button type="submit" className={button}>
                      Refund {formatUsd(r.refund_cents)}
                    </button>
                  </form>
                ) : null}
                {r.status === 'requested' || r.status === 'received' ? (
                  <form action={returnRejectAction.bind(null, r.id)} className="mt-2 flex gap-2">
                    <input name="note" required placeholder="Why (internal)" className={input} />
                    <button type="submit" className="min-h-11 underline">
                      Reject
                    </button>
                  </form>
                ) : null}
                {r.status === 'refunded' ? `Refunded ${utc(r.decided_at)}` : null}
                {r.status === 'rejected' ? `Rejected ${utc(r.decided_at)}${r.note ? `: ${r.note}` : ''}` : null}
              </Cell>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}

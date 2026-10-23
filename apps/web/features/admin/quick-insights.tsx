import { formatUsd } from '@repo/shared/domain';

import { Cell, Empty, rupees, SectionTitle, Table } from './ui';

import type { QuickInsights } from '@repo/db/admin';

const KIND: Record<QuickInsights['shipments'][number]['kind'], string> = {
  quick: '7-day',
  standard: 'Normal',
  express: 'Express',
};
const pct = (n: number, of: number): string => (of > 0 ? `${Math.round((n / of) * 100)}%` : '—');

/**
 * D-154 step 5: watching the 7-day promise (admin_quick_insights), for the period's paid orders. How many orders had a
 * 7-day shipment and how many were split; where the 7-day pieces stop against the line (after the promo, as the line
 * counts them); on time per kind of shipment against the date promised at order (a delay notice moves the customer's
 * date, never the promise), with the late ones that had their notice first and those still open past their day;
 * 7-day pieces refunded as unavailable; and what the split costs in courier fees beyond one parcel.
 */
export function QuickInsightsSection({ q }: { q: QuickInsights }): React.JSX.Element {
  const line = q.line_cents !== null ? formatUsd(q.line_cents) : 'the line';
  return (
    <section className="space-y-4">
      <SectionTitle>7-day delivery</SectionTitle>
      <p>
        <strong>{q.with_quick}</strong> of {q.orders} orders had a 7-day shipment ({pct(q.with_quick, q.orders)});{' '}
        <strong>{q.split}</strong> {q.split === 1 ? 'was' : 'were'} split into two shipments.
      </p>
      {q.with_quick > 0 ? (
        <div className="space-y-2">
          <p className="text-ink-muted text-sm">7-day pieces per order after the promo, against {line}:</p>
          <Table head={[`Within $5 past`, '$5 – $15 past', 'More']}>
            <tr>
              <Cell>{q.past_line.within_5}</Cell>
              <Cell>{q.past_line.within_15}</Cell>
              <Cell>{q.past_line.more}</Cell>
            </tr>
          </Table>
        </div>
      ) : null}
      {q.shipments.every((s) => s.due === 0) ? (
        <Empty>No shipment has reached its promised day in this period.</Empty>
      ) : (
        <Table head={['Shipment', 'Due', 'On time', 'Late', 'Late, notice sent first', 'Open past its day']}>
          {q.shipments.map((s) => (
            <tr key={s.kind}>
              <Cell>{KIND[s.kind]}</Cell>
              <Cell>{s.due}</Cell>
              <Cell>
                {s.on_time} ({pct(s.on_time, s.due)})
              </Cell>
              <Cell className={s.late > 0 ? 'text-caution' : ''}>{s.late}</Cell>
              <Cell className={s.late > s.late_noticed ? 'text-caution' : ''}>
                {s.late_noticed} of {s.late}
              </Cell>
              <Cell>{s.overdue}</Cell>
            </tr>
          ))}
        </Table>
      )}
      <p className="text-sm">
        7-day pieces refunded as unavailable: <strong>{q.unavailable.pieces}</strong>
        {q.unavailable.pieces > 0 ? ` (${formatUsd(q.unavailable.cents)})` : ''} · The split&apos;s extra courier cost:{' '}
        <strong>{rupees(q.split_extra_paise)}</strong>
        {q.split > 0 ? ` over ${q.split} split ${q.split === 1 ? 'order' : 'orders'}` : ''}
      </p>
    </section>
  );
}

import { doorDate, DUTIES_PAID, formatUsd } from '@repo/shared/domain';

import { DutiesStamp } from './duties-stamp';
import { LocalDateTime } from './local-date-time';
import { WeekStrip } from './week-strip';

import type { DeliveryWindow } from '@repo/db/store';

/**
 * D-008 / D-035: the next delivery window and its "order by" time, straight
 * from the open cycle, or in the made-to-order pilot today + its days with no "order by" (D-115, Settings). Never a
 * hard-coded promise. A piece already in the US
 * (D-072) has its own window: today + the US delivery days, and a 7-day piece (D-148) today + the 7-day days. D-154:
 * a 7-day piece shows the usual window and its own date with $49.99 of 7-day pieces (the line from Settings). D-161
 * (the homesick plan): "At your door … if you order today", "Duties paid. Nothing to pay at your door." with its stamp,
 * and a 7-day piece's week strip.
 */
export function DeliveryNote({
  delivery,
  fromUs = null,
  quick = null,
  quickLine = null,
}: {
  delivery: DeliveryWindow | null;
  fromUs?: { est_delivery_from: string; est_delivery_to: string } | null;
  /** D-148: a 7-day piece's window, kept only by a bag of 7-day pieces alone. */
  quick?: { est_delivery_from: string; est_delivery_to: string } | null;
  /** D-154: the 7-day days as words ("7") and the 7-day line in cents, from the store's policy. */
  quickLine?: { days: string; minCents: number } | null;
}): React.JSX.Element {
  const dates = (d: { est_delivery_from: string; est_delivery_to: string }): string =>
    doorDate(d.est_delivery_from, d.est_delivery_to);
  let line: React.ReactNode;
  if (quick && quickLine) {
    line = (
      <>
        {delivery ? (
          <>
            At your door <strong>{dates(delivery)}</strong> if you order today.{' '}
          </>
        ) : null}
        <span className={delivery ? 'text-ink-muted' : undefined}>
          With {formatUsd(quickLine.minCents)} of 7-day pieces, <strong className="text-ink">{dates(quick)}</strong>, and
          the delivery is free.
        </span>
      </>
    );
  } else if (quick) {
    line = (
      <>
        At your door <strong>{dates(quick)}</strong>{' '}
        <span className="text-ink-muted">
          when your bag holds only 7-day pieces{delivery ? `; with others, ${dates(delivery)}` : ''}.
        </span>
      </>
    );
  } else if (fromUs) {
    line = (
      <>
        Already in the US. At your door <strong>{dates(fromUs)}</strong>{' '}
        <span className="text-ink-muted">when ordered on its own.</span>
      </>
    );
  } else if (!delivery) {
    return <p className="text-ink-muted text-sm">The next delivery window has not been announced yet.</p>;
  } else {
    line = (
      <>
        From India to your door <strong>{dates(delivery)}</strong>
        {delivery.order_by ? (
          <span className="text-ink-muted">
            {' '}
            if you order by <LocalDateTime iso={delivery.order_by} />
          </span>
        ) : (
          ' if you order today.'
        )}
      </>
    );
  }
  return (
    <div className="relative pr-[68px]">
      <p className="text-ink m-0 text-sm">{line}</p>
      {DUTIES_PAID ? <p className="text-ink-muted m-0 mt-1.5 text-[13px]">Duties paid. Nothing to pay at your door.</p> : null}
      {quick ? <WeekStrip /> : null}
      <DutiesStamp />
    </div>
  );
}

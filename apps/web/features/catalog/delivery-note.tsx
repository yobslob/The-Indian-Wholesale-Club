import { formatDeliveryWindow } from '@repo/shared/domain';

import { LocalDateTime } from './local-date-time';

import type { DeliveryWindow } from '@repo/db/store';

/**
 * D-008 / D-035: the next delivery window and its "order by" time, straight
 * from the open cycle. Never a hard-coded promise.
 */
export function DeliveryNote({ delivery }: { delivery: DeliveryWindow | null }): React.JSX.Element {
  if (!delivery) {
    return (
      <p className="text-ink-muted text-sm">The next delivery window has not been announced yet.</p>
    );
  }
  return (
    <p className="text-ink text-sm">
      Estimated delivery{' '}
      <strong>{formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to)}</strong>{' '}
      <span className="text-ink-muted">
        if you order by <LocalDateTime iso={delivery.order_by} />
      </span>
    </p>
  );
}

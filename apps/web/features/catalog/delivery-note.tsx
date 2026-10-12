import { formatDeliveryWindow } from '@repo/shared/domain';

import { LocalDateTime } from './local-date-time';

import type { DeliveryWindow } from '@repo/db/store';

/**
 * D-008 / D-035: the next delivery window and its "order by" time, straight
 * from the open cycle, or in the made-to-order pilot today + its days with no "order by" (D-115, Settings). Never a
 * hard-coded promise. A piece already in the US
 * (D-072) has its own window: today + the US delivery days.
 */
export function DeliveryNote({
  delivery,
  fromUs = null,
}: {
  delivery: DeliveryWindow | null;
  fromUs?: { est_delivery_from: string; est_delivery_to: string } | null;
}): React.JSX.Element {
  if (fromUs) {
    return (
      <p className="text-ink text-sm">
        Already in the US. Estimated delivery{' '}
        <strong>{formatDeliveryWindow(fromUs.est_delivery_from, fromUs.est_delivery_to)}</strong>{' '}
        <span className="text-ink-muted">when ordered on its own.</span>
      </p>
    );
  }
  if (!delivery) {
    return (
      <p className="text-ink-muted text-sm">The next delivery window has not been announced yet.</p>
    );
  }
  return (
    <p className="text-ink text-sm">
      Estimated delivery{' '}
      <strong>{formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to)}</strong>
      {delivery.order_by ? (
        <span className="text-ink-muted">
          {' '}
          if you order by <LocalDateTime iso={delivery.order_by} />
        </span>
      ) : null}
    </p>
  );
}

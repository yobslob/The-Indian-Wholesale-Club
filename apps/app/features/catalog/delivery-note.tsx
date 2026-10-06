import { Text } from 'react-native';

import { formatDeliveryWindow } from '@repo/shared/domain';

import type { DeliveryWindow } from '@repo/db/store';

const orderBy = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
});

/**
 * D-008 / D-035: the next delivery window, straight from the open cycle, in the phone's time zone. A piece already in
 * the US (D-072) has its own window: today + the US delivery days.
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
      <Text className="font-body text-ink text-sm leading-5">
        Already in the US. Estimated delivery {formatDeliveryWindow(fromUs.est_delivery_from, fromUs.est_delivery_to)}
        <Text className="text-ink-muted"> when ordered on its own.</Text>
      </Text>
    );
  }
  if (!delivery) {
    return (
      <Text className="font-body text-ink-muted text-sm">
        The next delivery window has not been announced yet.
      </Text>
    );
  }
  return (
    <Text className="font-body text-ink text-sm leading-5">
      Estimated delivery{' '}
      {formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to)}
      <Text className="text-ink-muted">
        {' '}
        if you order by {orderBy.format(new Date(delivery.order_by))}
      </Text>
    </Text>
  );
}

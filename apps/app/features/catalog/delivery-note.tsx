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

/** D-008 / D-035: the next delivery window, straight from the open cycle, in the phone's time zone. */
export function DeliveryNote({ delivery }: { delivery: DeliveryWindow | null }): React.JSX.Element {
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

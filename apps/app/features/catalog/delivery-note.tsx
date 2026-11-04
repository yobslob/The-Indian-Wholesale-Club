import { Text } from 'react-native';

import { formatDeliveryWindow, type ProductType } from '@repo/shared/domain';

import { useDeliveryLine } from '@/features/shell/days';

/**
 * D-187: "Arrives in 7 delivery days" for food, "Arrives in 12 – 16 delivery days" for the rest (Settings' days, never
 * typed); the FAQ says what a delivery day is. A piece already in the US (D-072) has its own window: today + the US
 * delivery days.
 */
export function DeliveryNote({
  productType,
  fromUs = null,
}: {
  productType: ProductType;
  fromUs?: { est_delivery_from: string; est_delivery_to: string } | null;
}): React.JSX.Element | null {
  const days = useDeliveryLine(productType);
  if (fromUs) {
    return (
      <Text className="font-body text-ink text-sm leading-5">
        Already in the US. Estimated delivery {formatDeliveryWindow(fromUs.est_delivery_from, fromUs.est_delivery_to)}
        <Text className="text-ink-muted"> when ordered on its own.</Text>
      </Text>
    );
  }
  return days ? <Text className="font-body text-ink text-sm leading-5">Arrives in {days}</Text> : null;
}

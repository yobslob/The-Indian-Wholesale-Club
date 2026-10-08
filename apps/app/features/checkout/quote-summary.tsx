import { Pressable, Text, View } from 'react-native';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { CheckoutQuote, ShippingMethod } from '@repo/shared/domain';


/**
 * Standard (free) or express shipping, each with its own delivery window
 * (D-041, D-008). Hidden until express is set up (Q-18).
 */
export function ShippingOptions({
  quote,
  disabled,
  onChange,
}: {
  quote: CheckoutQuote;
  disabled: boolean;
  onChange: (method: ShippingMethod) => void;
}): React.JSX.Element | null {
  const { standard, express } = quote.options;
  if (!express) return null;
  const options = [
    { method: 'standard' as const, label: 'Standard', option: standard },
    { method: 'express' as const, label: 'Express (courier from India to your door)', option: express },
  ];
  return (
    <View className="gap-2">
      <Text className="font-ui-semibold text-ink-muted text-[11px] uppercase tracking-[1.8px]">Shipping</Text>
      {options.map(({ method, label, option }) => {
        const selected = quote.shippingMethod === method;
        return (
          <Pressable
            key={method}
            onPress={() => !selected && onChange(method)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            className={`bg-paper min-h-[52px] flex-row items-center gap-3 rounded-md border px-3.5 ${selected ? 'border-ink' : 'border-line'}`}
          >
            <Text className="font-ui text-ink flex-1 text-sm">
              {selected ? '● ' : '○ '}
              {label} · {option.shippingCents === 0 ? 'Free' : formatUsd(option.shippingCents)}
            </Text>
            <Text className="font-ui text-ink-muted text-[13px]">
              {formatDeliveryWindow(
                option.delivery.est_delivery_from,
                option.delivery.est_delivery_to,
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

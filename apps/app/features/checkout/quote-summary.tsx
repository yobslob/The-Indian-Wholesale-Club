import { Pressable, Text, View } from 'react-native';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { CheckoutQuote, ShippingMethod } from '@repo/shared/domain';

import { Card, Row } from '@/components/ui';

/** Server-priced totals and the delivery window, shown before payment (D-008). */
export function QuoteSummary({ quote }: { quote: CheckoutQuote }): React.JSX.Element {
  const b = quote.breakdown;
  return (
    <Card>
      {quote.lines.map((l) => (
        <Row
          key={l.variantId}
          label={`${l.productName} · ${l.variantLabel} × ${l.quantity}`}
          value={formatUsd(l.totalCents)}
        />
      ))}
      <View className="border-line my-1 border-t" />
      <Row label="Subtotal" value={formatUsd(b.subtotalCents)} />
      {b.discountCents > 0 ? (
        <Row
          label={`Discount (${quote.promoCode ?? ''})`}
          value={`−${formatUsd(b.discountCents)}`}
        />
      ) : null}
      <Row
        label={quote.shippingMethod === 'express' ? 'Express shipping' : 'Shipping'}
        value={b.shippingCents === 0 ? 'Free' : formatUsd(b.shippingCents)}
      />
      <Row label="Estimated tax" value={formatUsd(b.taxCents)} />
      <View className="border-line my-1 border-t" />
      <Row label="Total" value={formatUsd(b.totalCents)} />
      {quote.promoRejected ? (
        <Text className="text-caution text-sm">
          That promo code can&apos;t be used on this order.
        </Text>
      ) : null}
      <Text className="text-ink text-sm">
        Estimated delivery:{' '}
        {formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}
      </Text>
    </Card>
  );
}

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
    { method: 'express' as const, label: 'Express', option: express },
  ];
  return (
    <View className="gap-2">
      <Text className="text-ink text-sm font-medium">Shipping</Text>
      {options.map(({ method, label, option }) => {
        const selected = quote.shippingMethod === method;
        return (
          <Pressable
            key={method}
            onPress={() => !selected && onChange(method)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            className={`min-h-11 flex-row items-center gap-3 rounded-sm border px-3 ${selected ? 'border-ink' : 'border-line'}`}
          >
            <Text className="text-ink flex-1 text-sm">
              {selected ? '● ' : '○ '}
              {label} · {option.shippingCents === 0 ? 'Free' : formatUsd(option.shippingCents)}
            </Text>
            <Text className="text-ink-muted text-sm">
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

import { Linking, Pressable, Text, View } from 'react-native';

import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TIMELINE,
  formatDeliveryWindow,
  formatUsd,
  orderEventLabel,
  timelineIndex,
  trackingUrl,
} from '@repo/shared/domain';

import { FasterOffer } from './faster-offer';
import { OrderChoices } from './order-choices';

import type { OrderDetail } from '@repo/db/store';

import { Body, Card, Heading, Row, Title } from '@/components/ui';

const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * One order as the customer sees it (flows.md §8), the same content as the
 * website's order page. OrderDetail holds only customer-safe fields
 * (store_my_order / guest_order_lookup), so nothing internal can show (D-003).
 */
export function OrderView({
  order,
  onChanged,
}: {
  order: OrderDetail;
  /** Reload after the customer takes the faster-delivery offer (D-064). */
  onChanged?: () => void;
}): React.JSX.Element {
  const o = order.order;
  const step = timelineIndex(o.customer_status);
  const tracking = trackingUrl(o.carrier, o.tracking_number);
  return (
    <>
      <Body muted>Order {o.order_number}</Body>
      <Title>{CUSTOMER_STATUS_LABEL[o.customer_status]}</Title>
      {o.est_delivery_from && o.est_delivery_to ? (
        <Body>
          Estimated delivery {formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}
        </Body>
      ) : null}
      {o.carrier || o.tracking_number ? (
        // D-066: a link for USPS, UPS and FedEx; any other carrier shows its number.
        tracking ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(tracking)} className="min-h-11 justify-center">
            <Text className="font-body text-ink text-[15px] underline">
              Track it: {o.carrier} {o.tracking_number}
            </Text>
          </Pressable>
        ) : (
          <Body>Tracking: {[o.carrier, o.tracking_number].filter(Boolean).join(' ')}</Body>
        )
      ) : null}

      {order.offer ? (
        <FasterOffer offer={order.offer} orderNumber={o.order_number} email={o.email} onChanged={onChanged} />
      ) : null}
      {order.actions ? (
        <OrderChoices
          actions={order.actions}
          orderNumber={o.order_number}
          email={o.email}
          window={o.est_delivery_from && o.est_delivery_to ? { from: o.est_delivery_from, to: o.est_delivery_to } : null}
          onChanged={onChanged}
        />
      ) : null}

      {step >= 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {CUSTOMER_TIMELINE.map((s, i) => (
            <Text
              key={s}
              className={`rounded-sm border px-2 py-1 text-xs ${i <= step ? 'border-ink text-ink' : 'border-line text-ink-muted'}`}
            >
              {CUSTOMER_STATUS_LABEL[s]}
            </Text>
          ))}
        </View>
      ) : null}

      <Card>
        {order.items.map((item) => (
          <View key={item.id} className="gap-0.5 py-1">
            <Row
              label={`${item.product_name} · ${item.variant_label} · ${item.region_name} × ${item.quantity}`}
              value={formatUsd(item.total_price_cents)}
            />
            {item.status !== 'active' ? (
              <Text className="text-caution text-sm">
                {item.status === 'unavailable' ? 'No longer available, being refunded' : 'Refunded'}
              </Text>
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <Row label="Subtotal" value={formatUsd(o.subtotal_cents)} />
        {o.discount_cents > 0 ? (
          <Row label="Discount" value={`−${formatUsd(o.discount_cents)}`} />
        ) : null}
        <Row
          label={o.shipping_method === 'express' ? 'Express shipping' : 'Shipping'}
          value={o.shipping_cents === 0 ? 'Free' : formatUsd(o.shipping_cents)}
        />
        <Row label="Sales tax" value={formatUsd(o.tax_cents)} />
        <Row label="Total" value={formatUsd(o.total_cents)} />
        {o.refunded_cents > 0 ? <Row label="Refunded" value={formatUsd(o.refunded_cents)} /> : null}
      </Card>

      {order.events.length > 0 ? (
        <>
          <Heading>Updates</Heading>
          {order.events.map((e) => (
            <Body key={e.id}>
              {date.format(new Date(e.created_at))} · {orderEventLabel(e.kind)}
              {e.message ? ` · ${e.message}` : ''}
            </Body>
          ))}
        </>
      ) : null}
    </>
  );
}

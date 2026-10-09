import Ionicons from '@expo/vector-icons/Ionicons';
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
import { ReturnChoices } from './return-choices';

import type { OrderDetail } from '@repo/db/store';

import { Photo } from '@/components/photo';
import { Body, Heading, Row } from '@/components/ui';

const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
/** The update that marks each timeline step reached (order_events.kind). */
const STEP_EVENT: Record<string, string> = { confirmed: 'order_confirmed', preparing: 'preparing', shipped: 'shipped', delivered: 'delivered' };

/** Confirmed → Preparing → Shipped → Delivered as a line that fills to the current step, with each reached step's date (D-088). */
function Timeline({ order, step }: { order: OrderDetail; step: number }): React.JSX.Element {
  const last = CUSTOMER_TIMELINE.length - 1;
  return (
    <View className="mt-4" accessibilityLabel="Order progress">
      <View className="bg-line absolute left-[12.5%] right-[12.5%] top-[9px] h-0.5" />
      <View className="bg-ink absolute left-[12.5%] top-[9px] h-0.5" style={{ width: `${(75 * step) / last}%` }} />
      <View className="flex-row">
        {CUSTOMER_TIMELINE.map((s, i) => {
          const reached = i <= step;
          const event = reached ? order.events.find((e) => e.kind === STEP_EVENT[s]) : undefined;
          return (
            <View key={s} className="flex-1 items-center" accessibilityState={{ selected: i === step }}>
              <View className={`mb-1.5 h-5 w-5 rounded-full border-2 ${reached ? 'border-ink bg-ink' : 'border-line bg-canvas'}`} />
              <Text className={`font-ui text-center text-xs ${reached ? 'text-ink' : 'text-ink-muted'}`}>{CUSTOMER_STATUS_LABEL[s]}</Text>
              {event ? <Text className="font-ui text-ink-muted text-center text-[11px]">{shortDate.format(new Date(event.created_at))}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * One order as the customer sees it (flows.md §8, D-088, D-095), the same content as the website's order page: a
 * status card (number, status, delivery window, Track the parcel once shipped, the timeline), the offer and choices
 * when they apply, the pieces with photos, the totals and the updates. OrderDetail holds only customer-safe fields
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
      <View className="bg-surface rounded-lg p-5">
        <Text className="font-ui text-ink-muted text-[13px]">Order {o.order_number}</Text>
        <Text accessibilityRole="header" className="font-heading mt-2 text-[30px] leading-[33px] text-[#1D1A17]">
          {CUSTOMER_STATUS_LABEL[o.customer_status]}
        </Text>
        {o.est_delivery_from && o.est_delivery_to ? (
          <Text className="font-body text-ink mt-2 text-[15px]">
            Estimated delivery <Text className="font-ui-semibold">{formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}</Text>
          </Text>
        ) : null}
        {o.carrier || o.tracking_number ? (
          // D-066: a button for USPS, UPS and FedEx; any other carrier shows its number.
          <View className="mt-4 gap-2">
            {tracking ? (
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(tracking)} className="bg-brand min-h-12 flex-row items-center justify-center gap-2 self-start rounded-pill px-5">
                <Text className="font-ui-semibold text-on-brand text-[15px]">Track the parcel</Text>
                <Ionicons name="open-outline" size={16} color="#fff" />
              </Pressable>
            ) : null}
            <Text className="font-ui text-ink-muted text-[13px]">{[o.carrier, o.tracking_number].filter(Boolean).join(' · ')}</Text>
          </View>
        ) : null}
        {step >= 0 ? <Timeline order={order} step={step} /> : null}
      </View>

      {order.offer ? <FasterOffer offer={order.offer} orderNumber={o.order_number} email={o.email} onChanged={onChanged} /> : null}
      {order.actions ? (
        <OrderChoices
          actions={order.actions}
          orderNumber={o.order_number}
          email={o.email}
          window={o.est_delivery_from && o.est_delivery_to ? { from: o.est_delivery_from, to: o.est_delivery_to } : null}
          paidCents={o.total_cents - o.refunded_cents}
          onChanged={onChanged}
        />
      ) : null}
      {order.actions && order.actions.returns.length > 0 ? (
        <ReturnChoices returns={order.actions.returns} items={order.items} orderNumber={o.order_number} email={o.email} onChanged={onChanged} />
      ) : null}

      <View className="border-line border-t">
        {order.items.map((item) => (
          <View key={item.id} className="border-line flex-row items-center gap-3.5 border-b py-3">
            <View className="bg-land aspect-[3/4] w-14 overflow-hidden rounded-[10px]">{item.image_path ? <Photo path={item.image_path} width={56} /> : null}</View>
            <View className="flex-1">
              <Text className="font-ui-semibold text-ink text-[15px]">{item.product_name}</Text>
              <Text className="font-ui text-ink-muted text-[13px]">
                {item.variant_label} · {item.region_name} · × {item.quantity}
              </Text>
              {item.status !== 'active' ? (
                <Text className="text-caution font-ui text-[13px]">{item.status === 'unavailable' ? 'No longer available, being refunded' : 'Refunded'}</Text>
              ) : null}
            </View>
            <Text className="font-ui text-ink text-[15px]">{formatUsd(item.total_price_cents)}</Text>
          </View>
        ))}
      </View>

      <View className="gap-1.5">
        <Row label="Subtotal" value={formatUsd(o.subtotal_cents)} />
        {o.discount_cents > 0 ? <Row label="Discount" value={`−${formatUsd(o.discount_cents)}`} /> : null}
        <Row label={o.shipping_method === 'express' ? 'Express shipping' : 'Shipping'} value={o.shipping_cents === 0 ? 'Free' : formatUsd(o.shipping_cents)} />
        <Row label="Sales tax" value={formatUsd(o.tax_cents)} />
        <View className="border-line flex-row justify-between border-t pt-2">
          <Text className="font-ui-semibold text-ink text-base">Total</Text>
          <Text className="font-ui-semibold text-ink text-base">{formatUsd(o.total_cents)}</Text>
        </View>
        {o.refunded_cents > 0 ? <Row label="Refunded" value={formatUsd(o.refunded_cents)} /> : null}
      </View>

      {order.events.length > 0 ? (
        <View className="gap-1.5">
          <Heading>Updates</Heading>
          {order.events.map((e) => (
            <Body key={e.id}>
              {date.format(new Date(e.created_at))} · {orderEventLabel(e.kind)}
              {e.message ? ` · ${e.message}` : ''}
            </Body>
          ))}
        </View>
      ) : null}
    </>
  );
}

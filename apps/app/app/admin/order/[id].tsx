import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { getAdminOrder } from '@repo/db/admin';
import { formatUsd, orderEventLabel } from '@repo/shared/domain';

import {
  Body,
  Card,
  ErrorText,
  Heading,
  Loading,
  Row,
  Screen,
  Title,
} from '@/components/ui';
import { utc } from '@/features/admin/format';
import { ShipPanel } from '@/features/admin/ship-panel';
import { useAction } from '@/features/admin/use-action';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Order detail for the US desk: items with pickup state, the full internal
 * timeline, pack & ship. Refunds and cancellations are on the web panel only
 * (they need the Stripe secret key on the server, D-042).
 */
export default function AdminOrderScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    data: order,
    error,
    loading,
    reload,
  } = useQuery(`admin:order:${id}`, () => getAdminOrder(supabase, id));
  const action = useAction(reload);

  if (!order) {
    return (
      <Screen refreshing={loading} onRefresh={reload} back={false}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading ? <Loading /> : <Body muted>Order not found.</Body>}
      </Screen>
    );
  }

  const address = order.shipping_address as Record<string, string | null>;
  const events = [...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <Screen refreshing={loading} onRefresh={reload} back={false}>
      <Title>{order.order_number}</Title>
      <Card>
        <Row label="Status" value={order.status} />
        <Row label="Payment" value={order.payment_status} />
        <Row label="Total" value={formatUsd(order.total_cents)} />
        {order.refunded_cents > 0 ? (
          <Row label="Refunded" value={formatUsd(order.refunded_cents)} />
        ) : null}
        <Row label="Shipping" value={order.shipping_method} />
        <Row
          label="Promised"
          value={`${order.est_delivery_from ?? '—'} → ${order.est_delivery_to ?? '—'}`}
        />
        <Row label="Placed" value={utc(order.created_at)} />
        {order.carrier ? (
          <Row label="Tracking" value={`${order.carrier} ${order.tracking_number ?? ''}`} />
        ) : null}
      </Card>
      <Body muted>
        {order.email}
        {'\n'}
        {[
          address.fullName,
          address.line1,
          address.line2,
          `${address.city ?? ''}, ${address.state ?? ''} ${address.zipCode ?? ''}`,
          address.phone,
        ]
          .filter(Boolean)
          .join('\n')}
      </Body>

      <Heading>Items</Heading>
      {order.items.map((item) => (
        <Card key={item.id}>
          <Text className="text-ink">
            {item.product_name} · {item.variant_label} × {item.quantity}
          </Text>
          <Text
            className={
              item.status === 'unavailable' ? 'text-caution text-sm' : 'text-ink-muted text-sm'
            }
          >
            {item.status} · {formatUsd(item.total_price_cents)} · pickup{' '}
            {item.pickup ? `${item.pickup.status}${item.pickup.payout_id ? ' · paid' : ''}` : '—'}
          </Text>
        </Card>
      ))}

      <ShipPanel order={order} busy={action.busy} run={action.run} />
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}

      <Heading>Timeline</Heading>
      {events.map((e) => (
        <Body key={e.id}>
          {utc(e.created_at)} · {orderEventLabel(e.kind)}
          {e.visible_to_customer ? '' : ' (internal)'}
          {e.message ? ` · ${e.message}` : ''}
          {e.internal_note ? ` · ${e.internal_note}` : ''}
        </Body>
      ))}
    </Screen>
  );
}

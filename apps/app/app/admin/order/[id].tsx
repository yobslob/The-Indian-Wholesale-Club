import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { getAdminOrder, markPickup } from '@repo/db/admin';
import { adminEventText, dateRange, deskTime, ORDER_STATUS, PAYMENT_STATUS, PICKUP_STATUS, shipState } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { DeliverSheet, ShipSheet } from '@/features/admin/bulk-ship';
import { rupees } from '@/features/admin/format';
import { AdminButton, Chip, ConfirmSheet, Panel, StatusChip, useDesk } from '@/features/admin/ui';
import { useAction } from '@/features/admin/use-action';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * An order (D-097): chips, the pieces with photos and where each pickup stands, the customer with Call / Text, the
 * timeline in plain words; the one main action at the bottom (Pack & ship opens a sheet; Mark delivered asks first).
 * Refunds and cancels need the Stripe key on the server, so they stay on the web panel (D-042).
 */
const pieceCount = (n: number): string => `${n} piece${n === 1 ? '' : 's'}`;

export default function AdminOrderScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const desk = useDesk();
  const { data: order, error, loading, reload } = useQuery(`admin:order:${id}`, () => getAdminOrder(supabase, id));
  const action = useAction(reload);
  const [sheet, setSheet] = useState<'ship' | 'deliver' | null>(null);
  const [unavailable, setUnavailable] = useState<{ id: string; name: string } | null>(null);

  if (!order) {
    return (
      <Screen title="Order" refreshing={loading} onRefresh={reload}>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {loading ? <Loading /> : <Body muted>Order not found.</Body>}
      </Screen>
    );
  }

  const a = order.shipping_address as Record<string, string | null>;
  const events = [...order.events].sort((x, y) => x.created_at.localeCompare(y.created_at));
  const { canShip, express } = shipState(order);
  const expressInIndia = express && ['confirmed', 'collecting'].includes(order.status);
  const target = [{ id: order.id, number: order.order_number, name: a.fullName ?? '' }];
  const phone = (a.phone ?? '').replace(/[^\d+]/g, '');
  const main = canShip ? (
    <AdminButton big label="Pack & ship" onPress={() => setSheet('ship')} />
  ) : order.status === 'shipped' ? (
    <AdminButton big label="Mark delivered" onPress={() => setSheet('deliver')} />
  ) : null;

  return (
    <>
      <Screen
        title="Order"
        refreshing={loading}
        onRefresh={reload}
        overlay={main ? <View className="bg-canvas border-line border-t px-3.5 pb-3 pt-2.5">{main}</View> : undefined}
      >
        <View className="gap-2">
          <Text accessibilityRole="header" className="font-ui-semibold text-ink text-[18px]">
            {order.order_number}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            <StatusChip map={ORDER_STATUS} status={order.status} />
            <StatusChip map={PAYMENT_STATUS} status={order.payment_status} />
            <Chip tone={express ? 'brand' : 'mute'}>{order.shipping_method === 'express' ? 'Express' : 'Standard'}</Chip>
          </View>
          <Text className="font-ui text-ink-muted text-[12.5px]">
            Placed {deskTime(order.created_at, desk).main} · promised {dateRange(order.est_delivery_from, order.est_delivery_to)}
            {order.cycle ? ` · cycle ${order.cycle.code}` : ''}
          </Text>
        </View>
        {action.error ? <ErrorText>{action.error}</ErrorText> : null}

        <Panel title="Pieces" note={pieceCount(order.items.reduce((n, i) => n + i.quantity, 0))}>
          {order.items.map((item) => {
            const media = item.product?.media.slice().sort((x, y) => Number(y.is_primary) - Number(x.is_primary) || x.sort_order - y.sort_order)[0];
            const p = item.pickup;
            return (
              <View key={item.id} className="border-line flex-row gap-3 border-t pt-2.5">
                <View className="bg-land h-[54px] w-10 overflow-hidden rounded-lg">{media ? <Photo path={media.storage_path} width={40} /> : null}</View>
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-ui-semibold text-ink text-[14px]">{item.product_name}</Text>
                  <Text className="font-body text-ink-muted text-[12.5px]">
                    {item.variant_label} · {item.region_name} · × {item.quantity} · {formatUsd(item.total_price_cents)}
                    {p?.vendor ? ` · ${p.vendor.shop_name} ${rupees(p.shop_price_paise)}` : ''}
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {item.status === 'unavailable' ? <Chip tone="bad">Unavailable · refund on the web panel</Chip> : null}
                    {item.status === 'refunded' ? <Chip tone="mute">Refunded</Chip> : null}
                    {p && item.status === 'active' ? <StatusChip map={PICKUP_STATUS} status={p.status} /> : null}
                    {p?.status === 'picked' ? p.payout_id ? <Chip tone="ok">Paid to shop</Chip> : <Chip tone="warn">Not paid yet</Chip> : null}
                    {p?.arrived_at ? <Chip tone="brand">In the US</Chip> : null}
                  </View>
                  {expressInIndia && p?.status === 'pending' ? (
                    <View className="mt-1 flex-row gap-2">
                      <View className="flex-1">
                        <AdminButton label="Picked" disabled={action.busy} onPress={() => void action.run(() => markPickup(supabase, p.id, 'picked'))} />
                      </View>
                      <View className="flex-1">
                        <AdminButton kind="secondary" label="Unavailable" onPress={() => setUnavailable({ id: p.id, name: item.product_name })} />
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Panel>

        <Panel title="Customer">
          <Text className="font-body text-ink text-[14px] leading-5">
            {[a.fullName, a.line1, a.line2, `${a.city ?? ''}, ${a.state ?? ''} ${a.zipCode ?? ''}`].filter(Boolean).join(' · ')}
          </Text>
          <Text className="font-body text-ink-muted text-[13px]">{order.email}</Text>
          <View className="flex-row gap-2">
            {phone ? (
              <>
                <View className="flex-1">
                  <AdminButton kind="secondary" icon="call-outline" label="Call" onPress={() => void Linking.openURL(`tel:${phone}`)} />
                </View>
                <View className="flex-1">
                  <AdminButton kind="secondary" icon="chatbubble-outline" label="Text" onPress={() => void Linking.openURL(`sms:${phone}`)} />
                </View>
              </>
            ) : null}
            <View className="flex-1">
              <AdminButton kind="secondary" icon="mail-outline" label="Email" onPress={() => void Linking.openURL(`mailto:${order.email}`)} />
            </View>
          </View>
          {order.tracking_number ? (
            <Text className="font-body text-ink text-[13px]">
              {order.carrier} · {order.tracking_number}
            </Text>
          ) : null}
        </Panel>

        <Panel title="Timeline" note="● the customer sees it">
          {events.map((e) => {
            const { text, note } = adminEventText(e);
            return (
              <View key={e.id} className="border-line flex-row gap-2.5 border-t pt-2">
                <Text className="font-body text-ink-muted w-[104px] text-[12px]">{deskTime(e.created_at, desk).main}</Text>
                <Text className="font-body text-ink flex-1 text-[13.5px] leading-5">
                  {e.visible_to_customer ? <Text className="text-brand">● </Text> : null}
                  {text}
                  {note ? <Text className="text-caution">{`\n${note}`}</Text> : null}
                </Text>
              </View>
            );
          })}
        </Panel>

        <Panel title="Money">
          <View className="flex-row justify-between">
            <Text className="font-body text-ink-muted text-[14px]">Total paid</Text>
            <Text className="font-ui-semibold text-ink text-[15px]">{formatUsd(order.total_cents)}</Text>
          </View>
          {order.refunded_cents > 0 ? (
            <View className="flex-row justify-between">
              <Text className="font-body text-ink-muted text-[14px]">Refunded</Text>
              <Text className="font-body text-ink text-[14px]">−{formatUsd(order.refunded_cents)}</Text>
            </View>
          ) : null}
          <Text className="font-body text-ink-muted text-[12.5px]">Refunds, cancels and new delivery dates are on the web panel.</Text>
        </Panel>
        {main ? <View className="h-20" /> : null}
      </Screen>
      <ShipSheet open={sheet === 'ship'} orders={target} onClose={() => setSheet(null)} onDone={() => (setSheet(null), reload())} />
      <DeliverSheet open={sheet === 'deliver'} orders={target} onClose={() => setSheet(null)} onDone={() => (setSheet(null), reload())} />
      <ConfirmSheet
        open={unavailable !== null}
        title={`${unavailable?.name ?? 'This piece'}: unavailable?`}
        confirm="Mark unavailable"
        busy={action.busy}
        onClose={() => setUnavailable(null)}
        onConfirm={() =>
          void action.run(() => markPickup(supabase, unavailable!.id, 'unavailable')).then(() => setUnavailable(null))
        }
      >
        The shop doesn&apos;t have it any more. The customer is emailed that it isn&apos;t coming; refund it on the web panel.
      </ConfirmSheet>
    </>
  );
}

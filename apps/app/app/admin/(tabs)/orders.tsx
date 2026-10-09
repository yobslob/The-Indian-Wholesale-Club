import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { countOrdersByStatus, listAdminOrders } from '@repo/db/admin';
import { ORDER_STATUS, PAYMENT_STATUS, deskTime } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import type { Enum } from '@repo/db';

import { Body, Button, ErrorText, Loading, Screen } from '@/components/ui';
import { DeliverSheet, ShipSheet, type ShipTarget } from '@/features/admin/bulk-ship';
import { AdminButton, AdminHead, StatusChip, useDesk } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

const CHIPS: (Enum<'order_status'> | 'all' | 'express')[] = ['all', 'arrived', 'confirmed', 'collecting', 'packed', 'in_transit', 'shipped', 'delivered', 'cancelled', 'express'];
const chipLabel = (c: (typeof CHIPS)[number]): string => (c === 'all' ? 'All' : c === 'express' ? 'Express to send' : ORDER_STATUS[c][0]);

/**
 * Orders (D-097, US desk): search, chips with counts, order cards, 50 at a time. A long press starts selecting, and a
 * bar offers Mark shipped… (one tracking number each) and Delivered. The database checks each order may change.
 */
export default function AdminOrdersScreen(): React.JSX.Element {
  const router = useRouter();
  const desk = useDesk();
  const params = useLocalSearchParams<{ status?: string; express?: string; q?: string }>();
  const filter = params.express === '1' ? 'express' : (CHIPS.find((c) => c === params.status) ?? 'all');
  const q = params.q ?? '';
  const [words, setWords] = useState(q);
  const { data: counts, reload: reloadCounts } = useQuery('admin:order-counts', () => countOrdersByStatus(supabase));
  const { items, error, loading, loadingMore, hasMore, loadMore, reload } = usePagedQuery(
    `admin:orders:${filter}:${q}`,
    (offset, limit) =>
      listAdminOrders(supabase, {
        ...(filter === 'express' ? { expressToSend: true } : filter === 'all' ? {} : { status: filter }),
        search: q,
        offset,
        limit,
      }).then((r) => r.orders),
    50,
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<'ship' | 'deliver' | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const selecting = picked.size > 0;
  const chosen = (items ?? []).filter((o) => picked.has(o.id));
  const target = (o: (typeof chosen)[number]): ShipTarget => ({
    id: o.id,
    number: o.order_number,
    name: (o.shipping_address as { fullName?: string } | null)?.fullName ?? '',
  });
  // Arrived in the US, or an express order still in India (D-070; the database refuses one not yet picked).
  const canShip = (o: (typeof chosen)[number]): boolean =>
    o.status === 'arrived' || (o.shipping_method === 'express' && !o.cycle_id && ['confirmed', 'collecting'].includes(o.status));
  const toShip = chosen.filter(canShip).map(target);
  const toDeliver = chosen.filter((o) => o.status === 'shipped').map(target);
  const toggle = (id: string): void =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const done = (verb: string, total: number) => (failed: string[]) => {
    setReport(`${total - failed.length} ${verb}.${failed.length ? ` ${failed.length} not changed: open them one by one.` : ''}`);
    setSheet(null);
    setPicked(new Set());
    reload();
    reloadCounts();
  };
  const count = (c: (typeof CHIPS)[number]): number | undefined =>
    !counts ? undefined : c === 'all' ? counts.all : c === 'express' ? counts.expressToSend : (counts.byStatus[c] ?? 0);

  return (
    <View className="bg-canvas flex-1">
      <Screen
        back={false}
        refreshing={loading}
        onRefresh={() => {
          reload();
          reloadCounts();
        }}
      >
        <AdminHead title="Orders" />
        <TextInput
          value={words}
          onChangeText={setWords}
          onSubmitEditing={() => router.setParams({ q: words.trim() })}
          placeholder="Number, name or email"
          placeholderTextColor={tokens.colors['ink-muted']}
          accessibilityLabel="Search orders"
          returnKeyType="search"
          className="border-line bg-paper text-ink font-ui -mt-2 min-h-11 rounded-xl border px-3.5 text-[15px]"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 -mt-2" contentContainerClassName="gap-1.5 px-4">
          {CHIPS.map((c) => {
            const on = c === filter;
            return (
              <Pressable
                key={c}
                onPress={() => router.setParams(c === 'express' ? { express: '1', status: '' } : { status: c === 'all' ? '' : c, express: '' })}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className={`h-9 flex-row items-center gap-1.5 rounded-pill border px-3 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
              >
                <Text className={`font-ui text-[13px] ${on ? 'text-paper' : 'text-ink'}`}>{chipLabel(c)}</Text>
                {count(c) !== undefined ? (
                  <Text className={`font-ui-semibold text-[13px] ${on ? 'text-[rgba(251,248,243,0.7)]' : 'text-ink-muted'}`}>{count(c)}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
        {q ? (
          <Pressable
            onPress={() => {
              setWords('');
              router.setParams({ q: '' });
            }}
            accessibilityRole="button"
          >
            <Text className="font-ui text-ink-muted text-[13px]">
              Found for “{q}” · <Text className="text-ink underline">clear</Text>
            </Text>
          </Pressable>
        ) : null}
        {report ? <Body>{report}</Body> : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!items && loading ? <Loading /> : null}
        {items && items.length === 0 ? <Body muted>No orders here.</Body> : null}
        <View className="-mt-2 gap-2">
          {items?.map((o) => {
            const on = picked.has(o.id);
            const pieces = o.items.reduce((n, i) => n + i.quantity, 0);
            const name = (o.shipping_address as { fullName?: string } | null)?.fullName ?? o.email;
            return (
              <Pressable
                key={o.id}
                onPress={() => (selecting ? toggle(o.id) : router.push({ pathname: '/admin/order/[id]', params: { id: o.id } }))}
                onLongPress={() => toggle(o.id)}
                accessibilityRole={selecting ? 'checkbox' : 'button'}
                accessibilityState={selecting ? { checked: on } : undefined}
                accessibilityHint={selecting ? undefined : 'Press and hold to select'}
                className={`flex-row gap-2.5 rounded-[14px] border p-3 ${on ? 'border-brand bg-[rgba(122,46,35,0.04)]' : 'border-line bg-paper'}`}
              >
                {selecting ? (
                  <View className={`mt-0.5 h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] ${on ? 'border-ink bg-ink' : 'border-ink-muted'}`}>
                    {on ? <Text className="font-ui-semibold text-paper text-[12px]">✓</Text> : null}
                  </View>
                ) : null}
                <View className="min-w-0 flex-1 gap-0.5">
                  <Text numberOfLines={1} className="font-ui-semibold text-ink text-[14px]">
                    {o.order_number}
                  </Text>
                  <Text numberOfLines={2} className="font-body text-ink-muted text-[12.5px]">
                    {name} · {pieces} piece{pieces === 1 ? '' : 's'} · {deskTime(o.created_at, desk).main}
                  </Text>
                  <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                    <StatusChip map={ORDER_STATUS} status={o.status} />
                    <StatusChip map={PAYMENT_STATUS} status={o.payment_status} />
                  </View>
                </View>
                <Text className="font-ui-semibold text-ink text-[14px]">{formatUsd(o.total_cents)}</Text>
              </Pressable>
            );
          })}
        </View>
        {hasMore ? <Button kind="secondary" label={loadingMore ? 'Loading…' : 'Show more'} disabled={loadingMore} onPress={loadMore} /> : null}
        {selecting ? <View className="h-16" /> : null}
      </Screen>
      {selecting ? (
        <View className="bg-ink absolute bottom-2.5 left-2.5 right-2.5 flex-row items-center gap-2 rounded-[14px] p-2.5">
          <Text numberOfLines={1} className="font-ui-semibold text-paper flex-1 text-[13px]">
            {picked.size} selected
          </Text>
          <AdminButton kind="secondary" label="Mark shipped…" disabled={toShip.length === 0} onPress={() => setSheet('ship')} />
          <AdminButton kind="secondary" label="Delivered" disabled={toDeliver.length === 0} onPress={() => setSheet('deliver')} />
          <Pressable onPress={() => setPicked(new Set())} accessibilityRole="button" accessibilityLabel="Clear the selection" className="h-11 w-9 items-center justify-center">
            <Text className="font-ui text-paper text-[18px]">×</Text>
          </Pressable>
        </View>
      ) : null}
      <ShipSheet open={sheet === 'ship'} orders={toShip} onClose={() => setSheet(null)} onDone={done('marked shipped', toShip.length)} />
      <DeliverSheet open={sheet === 'deliver'} orders={toDeliver} onClose={() => setSheet(null)} onDone={done('marked delivered', toDeliver.length)} />
    </View>
  );
}

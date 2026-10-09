import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  attentionLines,
  getAttention,
  getCycleTotals,
  getOpenCycle,
  getPickupCycle,
  getTodaySummary,
  getWaitingCounts,
} from '@repo/db/admin';
import { bothPlaces, deskOrder, deskTime, ORDER_STATUS, timeLeft, type Desk } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { CycleFlow } from '@/features/admin/cycle-flow';
import { Queue, type Job } from '@/features/admin/queue';
import { AdminButton, AdminHead, Chip, Group, Panel, useDesk } from '@/features/admin/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';


const DESK: Record<Desk, string> = { us: 'US desk', india: 'India desk' };
const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Today (D-097, on the web's D-096): the open cycle's countdown, totals and progress; Needs attention; the admin's own
 * desk as a work queue with one big button per job (D-007), the other desk below; new orders and status changes live
 * (PR-7, Realtime on `orders`, RLS decides what arrives); View the store.
 */
export default function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const { setViewingStore } = useSession();
  const desk = useDesk();
  const { data, error, loading, reload } = useQuery('admin:today', async () => {
    const [summary, counts, cycle, attention, pickupCycle] = await Promise.all([
      getTodaySummary(supabase),
      getWaitingCounts(supabase),
      getOpenCycle(supabase),
      getAttention(supabase),
      getPickupCycle(supabase),
    ]);
    const totals = cycle ? await getCycleTotals(supabase, cycle.id) : null;
    return { summary, counts, cycle, totals, pickupCycle, alerts: attentionLines(attention) };
  });
  const [live, setLive] = useState<string[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { order_number?: string; status?: Enum<'order_status'>; total_cents?: number };
        if (!row.order_number) return;
        const text =
          payload.eventType === 'INSERT'
            ? `New order ${row.order_number}${typeof row.total_cents === 'number' ? ` · ${formatUsd(row.total_cents)}` : ''}`
            : `${row.order_number} is now ${row.status ? ORDER_STATUS[row.status][0] : 'updated'}`;
        setLive((list) => [text, ...list].slice(0, 8));
        reload();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const now = new Date();
  const [own, other] = deskOrder(desk);
  const s = data?.summary;
  const jobs: Record<Desk, Job[]> | null =
    data && s
      ? {
          us: [
            { n: s.ordersByStatus.arrived ?? 0, what: 'Orders arrived in the US, to ship', go: 'Pack & ship', href: { pathname: '/admin/orders', params: { status: 'arrived' } }, urgent: true },
            { n: s.ordersByStatus.confirmed ?? 0, what: 'Orders confirmed in the open cycle', sub: 'Nothing to do until cutoff', go: 'See orders', href: { pathname: '/admin/orders', params: { status: 'confirmed' } } },
          ],
          india: [
            {
              n: s.pendingPickups,
              what: 'Pickups still to do',
              sub: data.pickupCycle ? `Cycle ${data.pickupCycle.code}` : undefined,
              go: 'Start pickups',
              href: data.pickupCycle ? { pathname: '/admin/cycle/[id]', params: { id: data.pickupCycle.id } } : '/admin/cycles',
              urgent: true,
            },
            { n: s.expressToSend, what: 'Express orders to pick up and send by courier', go: 'Open orders', href: { pathname: '/admin/orders', params: { express: '1' } }, urgent: true },
            { n: s.draftProducts, what: 'Draft listings to review', go: 'Review drafts', href: { pathname: '/admin/listings', params: { view: 'draft' } } },
            {
              n: data.counts.shopsOwed,
              what: 'Shops owed for picked pieces',
              sub: `${s.unpaidPickedPickups} picked piece${s.unpaidPickedPickups === 1 ? '' : 's'} not paid yet`,
              go: 'Pay shops',
              href: '/admin/payouts',
            },
            ...(s.staleVariants === null
              ? []
              : [{ n: s.staleVariants, what: 'Quantities to re-check with the shops', go: 'Re-check', href: { pathname: '/admin/listings', params: { view: 'live' } } } as Job]),
          ],
        }
      : null;
  const left = data?.cycle ? timeLeft(data.cycle.cutoff_at, now) : null;
  const places = data?.cycle ? bothPlaces(data.cycle.cutoff_at, desk) : null;
  const clock = deskTime(now, desk);

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <View className="gap-1">
        <AdminHead title="Today" />
        <Text className="font-ui text-ink-muted text-[12.5px]">
          {desk ? `${DESK[own]} · ` : ''}
          {clock.main.split(', ')[1]} · {clock.other}
        </Text>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data?.cycle && data.totals ? (
        <Pressable onPress={() => router.push({ pathname: '/admin/cycle/[id]', params: { id: data.cycle!.id } })} accessibilityRole="button">
          <Panel>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-ui text-ink-muted text-[12.5px]">Open cycle</Text>
              <Text className="font-ui-semibold text-ink text-[12.5px]">{data.cycle.code}</Text>
              <Chip tone="blue">Open</Chip>
            </View>
            <Text className="font-heading-semibold text-ink text-[28px] leading-8">{left ?? 'Cutoff passed'}</Text>
            <Text className="font-ui text-ink-muted -mt-1.5 text-[13px] leading-[18px]">
              {left ? 'to cutoff · ' : ''}
              {places?.[0]} · {places?.[1]}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[
                [data.totals.orders, 'orders'],
                [data.totals.pieces, 'pieces'],
                [data.totals.shops, 'shops'],
                [dollars.format(Math.round(data.totals.salesCents / 100)), 'sales'],
              ].map(([v, l]) => (
                <View key={l} className="bg-canvas w-[47%] flex-grow rounded-[10px] px-3 py-2.5">
                  <Text className="font-ui-semibold text-ink text-[20px]">{v}</Text>
                  <Text className="font-ui text-ink-muted text-[12px]">{l}</Text>
                </View>
              ))}
            </View>
            <CycleFlow cycle={data.cycle} desk={desk} />
          </Panel>
        </Pressable>
      ) : data ? (
        <Panel>
          <Text className="font-ui-semibold text-caution">No open cycle: customers cannot check out. Open one on the web panel.</Text>
        </Panel>
      ) : null}
      {data && data.alerts.length > 0 ? (
        <View className="gap-1 rounded-xl border border-[rgba(138,90,0,0.25)] bg-[rgba(138,90,0,0.08)] px-3.5 py-3">
          <Text className="font-ui-semibold text-caution">Needs attention</Text>
          {data.alerts.map((line) => (
            <Text key={line} className="font-body text-ink text-[13px]">
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
      {jobs ? (
        <>
          <Group>{desk ? `${DESK[own]} · yours` : DESK[own]}</Group>
          <Queue jobs={jobs[own]} />
          <Group>{DESK[other]}</Group>
          <Queue jobs={jobs[other]} />
        </>
      ) : null}
      {live.length > 0 ? (
        <Panel title="Live orders">
          {live.map((line, i) => (
            <Body key={`${i}:${line}`} muted>
              {line}
            </Body>
          ))}
        </Panel>
      ) : null}
      <AdminButton kind="secondary" label="View the store" onPress={() => setViewingStore(true)} />
    </Screen>
  );
}

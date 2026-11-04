import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { attentionLines, getAttention, getTodaySummary, getWaitingCounts } from '@repo/db/admin';
import { deskOrder, deskTime, ORDER_STATUS, type Desk } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { Queue, type Job } from '@/features/admin/queue';
import { AdminButton, AdminHead, Group, Panel, useDesk } from '@/features/admin/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';


const DESK: Record<Desk, string> = { us: 'US desk', india: 'India desk' };

/**
 * Today (D-097, on the web's D-096; D-187): Needs attention; the admin's own desk as a work queue with one big button per job (D-007), the other desk below; new orders and status changes live
 * (PR-7, Realtime on `orders`, RLS decides what arrives); View the store.
 */
export default function TodayScreen(): React.JSX.Element {
  const { setViewingStore } = useSession();
  const desk = useDesk();
  const { data, error, loading, reload } = useQuery('admin:today', async () => {
    const [summary, counts, attention] = await Promise.all([getTodaySummary(supabase), getWaitingCounts(supabase), getAttention(supabase)]);
    return { summary, counts, alerts: attentionLines(attention) };
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
            { n: s.ordersByStatus.arrived ?? 0, what: 'Orders in the US, to ship', go: 'Pack & ship', href: { pathname: '/admin/orders', params: { status: 'arrived' } }, urgent: true },
            { n: s.ordersByStatus.confirmed ?? 0, what: 'Orders confirmed', sub: 'Each ships once its pieces are at the hub', go: 'See orders', href: { pathname: '/admin/orders', params: { status: 'confirmed' } } },
          ],
          india: [
            { n: data.counts.toOrder, what: 'Sold pieces to order online', sub: 'On each order: Order it online, then Mark ordered', go: 'See orders', href: { pathname: '/admin/orders', params: { status: 'confirmed' } }, urgent: true },
            { n: s.draftProducts, what: 'Draft listings to review', go: 'Review drafts', href: { pathname: '/admin/listings', params: { view: 'draft' } } },
            ...(s.staleVariants === null
              ? []
              : [{ n: s.staleVariants, what: 'Quantities to re-check with the shops', go: 'Re-check', href: { pathname: '/admin/listings', params: { view: 'live' } } } as Job]),
          ],
        }
      : null;
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

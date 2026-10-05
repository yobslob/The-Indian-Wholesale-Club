import { useRouter } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { attentionLines, getAttention, getMyDesk, getOpenCycle, getTodaySummary } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Href } from 'expo-router';

import { Body, Button, Card, ErrorText, Label, Loading, Screen, Title } from '@/components/ui';
import { utc } from '@/features/admin/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Today (admin.md): what needs doing now. Every item opens the screen that fixes it. The admin's own desk first
 * (D-007), and new orders and status changes live (PR-7, Realtime on `orders`, RLS decides what arrives).
 */
export default function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, setViewingStore } = useSession();
  const userId = session?.user.id ?? '';
  const { data, error, loading, reload } = useQuery(`admin:today:${userId}`, async () => {
    const [summary, cycle, desk, attention] = await Promise.all([
      getTodaySummary(supabase),
      getOpenCycle(supabase),
      userId ? getMyDesk(supabase, userId) : Promise.resolve(null),
      getAttention(supabase),
    ]);
    return { summary, cycle, desk, alerts: attentionLines(attention) };
  });
  const [live, setLive] = useState<string[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { order_number?: string; status?: string; total_cents?: number };
        if (!row.order_number) return;
        const text =
          payload.eventType === 'INSERT'
            ? `New order ${row.order_number}${typeof row.total_cents === 'number' ? ` · ${formatUsd(row.total_cents)}` : ''}`
            : `${row.order_number} is now ${row.status ?? 'updated'}`;
        setLive((list) => [text, ...list].slice(0, 8));
        reload();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reload]);

  const count = (status: 'confirmed' | 'arrived') => data?.summary.ordersByStatus[status] ?? 0;
  // [label, count, screen, desk]
  type Item = [string, number, Href, 'us' | 'india'];
  const all: Item[] = data
    ? [
        ['Orders confirmed in the open cycle', count('confirmed'), { pathname: '/admin/orders', params: { status: 'confirmed' } }, 'us'],
        ['Pickups still pending', data.summary.pendingPickups, '/admin/cycles', 'india'],
        ['Picked pieces not yet paid to shops', data.summary.unpaidPickedPickups, '/admin/payouts', 'india'],
        ['Orders arrived in the US, to pack and ship', count('arrived'), { pathname: '/admin/orders', params: { status: 'arrived' } }, 'us'],
        ['Draft listings to review', data.summary.draftProducts, '/admin/listings', 'india'],
        ...(data.summary.staleVariants === null
          ? []
          : ([['Quantities to re-check with the shops', data.summary.staleVariants, '/admin/listings', 'india']] as Item[])),
      ]
    : [];
  const desk = data?.desk ?? null;
  const groups: [string | null, Item[]][] = desk
    ? [
        [desk === 'india' ? 'India desk' : 'US desk', all.filter((i) => i[3] === desk)],
        [desk === 'india' ? 'US desk' : 'India desk', all.filter((i) => i[3] !== desk)],
      ]
    : [[null, all]];

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <Title>Today</Title>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data ? (
        data.cycle ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/admin/cycle/[id]', params: { id: data.cycle?.id ?? '' } })
            }
          >
            <Card>
              <Text className="text-ink font-medium">Open cycle {data.cycle.code}</Text>
              <Body muted>
                Cutoff {utc(data.cycle.cutoff_at)} · est. arrival {data.cycle.est_arrival_on}
              </Body>
            </Card>
          </Pressable>
        ) : (
          <Card>
            <Text className="text-caution">No open cycle: customers cannot check out.</Text>
            <Button kind="link" label="Cycles" onPress={() => router.push('/admin/cycles')} />
          </Card>
        )
      ) : null}
      {data && data.alerts.length > 0 ? (
        <Card>
          <Text className="text-caution font-medium">Needs attention</Text>
          {data.alerts.map((line) => (
            <Body key={line}>{line}</Body>
          ))}
        </Card>
      ) : null}
      {live.length > 0 ? (
        <Card>
          <Label>Live</Label>
          {live.map((line, i) => (
            <Body key={`${i}:${line}`}>{line}</Body>
          ))}
        </Card>
      ) : null}
      {groups.map(([title, rows]) => (
        <Fragment key={title ?? 'all'}>
          {title ? <Label>{title}</Label> : null}
          {rows.map(([label, n, href]) => (
            <Pressable
              key={label}
              onPress={() => router.push(href)}
              className="border-line min-h-11 flex-row items-center justify-between gap-3 rounded-md border p-3"
            >
              <Text className="text-ink flex-1">{label}</Text>
              <Text className="text-ink font-semibold">{n}</Text>
            </Pressable>
          ))}
        </Fragment>
      ))}
      <Body muted>Signed in as {session?.user.email ?? ''}</Body>
      <Button kind="link" label="View the store" onPress={() => setViewingStore(true)} />
      <Button kind="link" label="Sign out" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

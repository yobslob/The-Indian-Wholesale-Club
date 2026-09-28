import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { getOpenCycle, getTodaySummary } from '@repo/db/admin';

import type { Href } from 'expo-router';

import { Body, Button, Card, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { utc } from '@/features/admin/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Today (admin.md): what needs doing now. Every item opens the screen that fixes it. */
export default function TodayScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, setViewingStore } = useSession();
  const { data, error, loading, reload } = useQuery('admin:today', async () => {
    const [summary, cycle] = await Promise.all([getTodaySummary(supabase), getOpenCycle(supabase)]);
    return { summary, cycle };
  });

  const count = (status: 'confirmed' | 'arrived') => data?.summary.ordersByStatus[status] ?? 0;
  const items: [string, number, Href][] = data
    ? [
        [
          'Orders confirmed in the open cycle',
          count('confirmed'),
          { pathname: '/admin/orders', params: { status: 'confirmed' } },
        ],
        ['Pickups still pending', data.summary.pendingPickups, '/admin/cycles'],
        ['Picked pieces not yet paid to shops', data.summary.unpaidPickedPickups, '/admin/payouts'],
        [
          'Orders arrived in the US, to pack and ship',
          count('arrived'),
          { pathname: '/admin/orders', params: { status: 'arrived' } },
        ],
        ['Draft listings to review', data.summary.draftProducts, '/admin/listings'],
      ]
    : [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
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
      {items.map(([label, n, href]) => (
        <Pressable
          key={label}
          onPress={() => router.push(href)}
          className="border-line min-h-11 flex-row items-center justify-between gap-3 rounded-md border p-3"
        >
          <Text className="text-ink flex-1">{label}</Text>
          <Text className="text-ink font-semibold">{n}</Text>
        </Pressable>
      ))}
      <Body muted>Signed in as {session?.user.email ?? ''}</Body>
      <Button kind="link" label="View the store" onPress={() => setViewingStore(true)} />
      <Button kind="link" label="Sign out" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

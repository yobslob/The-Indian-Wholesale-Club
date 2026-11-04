import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { getWaitingCounts } from '@repo/db/admin';

import { TabBar } from '@/features/shell/tab-bar';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const ICONS = {
  index: 'today-outline',
  orders: 'receipt-outline',
  listings: 'pricetags-outline',
  more: 'ellipsis-horizontal',
} as const;

/**
 * The admin mode's four tabs (D-097, D-187): Today · Orders · Listings · More, with a count of what waits (pieces to
 * order, orders to ship, drafts), refreshed every minute and after each change.
 */
export default function AdminTabs(): React.JSX.Element {
  const { data: counts, reload } = useQuery('admin:waiting', () => getWaitingCounts(supabase));
  useEffect(() => {
    const timer = setInterval(reload, 60_000);
    return () => clearInterval(timer);
  }, [reload]);
  const badge = (n: number | undefined): number | undefined => (n ? n : undefined);

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} badgeLabel={(n) => `${n} waiting`} />}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarBadge: badge(counts?.toOrder) }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarBadge: badge(counts?.ordersToShip) }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarBadge: badge(counts?.drafts) }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}

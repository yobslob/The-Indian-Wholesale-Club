import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { getWaitingCounts } from '@repo/db/admin';

import { TabBar } from '@/features/shell/tab-bar';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const ICONS = {
  index: 'today-outline',
  orders: 'receipt-outline',
  cycles: 'boat-outline',
  listings: 'pricetags-outline',
  more: 'ellipsis-horizontal',
} as const;

/**
 * The admin mode's five tabs (D-097): Today · Orders · Cycle · Listings · More, each with a count of what waits
 * (orders to ship, pickups to do, drafts, shops owed), refreshed every minute and after each change.
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
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarBadge: badge(counts?.ordersToShip) }} />
      <Tabs.Screen name="cycles" options={{ title: 'Cycle', tabBarBadge: badge(counts?.pickupsToDo) }} />
      <Tabs.Screen name="listings" options={{ title: 'Listings', tabBarBadge: badge(counts?.drafts) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarBadge: badge(counts?.shopsOwed) }} />
    </Tabs>
  );
}

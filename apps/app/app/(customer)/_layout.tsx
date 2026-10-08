import { Redirect, Tabs } from 'expo-router';

import { bagCount, useBag } from '@/features/cart/store';
import { TabBar } from '@/features/shell/tab-bar';
import { useSession } from '@/lib/session';

/** Customer tabs (storefront.md §Mobile app, D-095): Home · Explore · Bag · Saved · Profile, on the app's own tab bar. */
export default function CustomerTabs(): React.JSX.Element {
  const { ready, isAdmin, viewingStore } = useSession();
  const count = useBag((s) => bagCount(s.lines));
  // A server-confirmed admin lands in admin mode (D-006); nothing here hints at it.
  if (ready && isAdmin && !viewingStore) return <Redirect href="/admin" />;

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="bag" options={{ title: 'Bag', tabBarBadge: count > 0 ? count : undefined }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

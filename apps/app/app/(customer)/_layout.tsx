import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import tokens from '@repo/tokens';

import { bagCount, useBag } from '@/features/cart/store';
import { useSession } from '@/lib/session';

/** Customer tabs (storefront.md §Mobile app): Home · Explore · Bag · Saved · Profile. */
export default function CustomerTabs(): React.JSX.Element {
  const { ready, isAdmin, viewingStore } = useSession();
  const count = useBag((s) => bagCount(s.lines));
  // A server-confirmed admin lands in admin mode (D-006); nothing here hints at it.
  if (ready && isAdmin && !viewingStore) return <Redirect href="/admin" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.ink,
        tabBarInactiveTintColor: tokens.colors['ink-muted'],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bag"
        options={{
          title: 'Bag',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color }) => <Ionicons name="bag-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

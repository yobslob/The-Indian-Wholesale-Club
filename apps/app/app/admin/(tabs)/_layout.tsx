import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import tokens from '@repo/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Today', icon: 'today-outline' },
  { name: 'orders', title: 'Orders', icon: 'receipt-outline' },
  { name: 'cycles', title: 'Cycles', icon: 'boat-outline' },
  { name: 'payouts', title: 'Payouts', icon: 'cash-outline' },
  { name: 'listings', title: 'Listings', icon: 'pricetags-outline' },
  { name: 'vendors', title: 'Vendors', icon: 'storefront-outline' },
];

/** The admin sections the app carries (admin.md §Sections, "App" column). */
export default function AdminTabs(): React.JSX.Element {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.ink,
        tabBarInactiveTintColor: tokens.colors['ink-muted'],
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Ionicons name={t.icon} size={22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}

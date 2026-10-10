import { Tabs } from 'expo-router';

import { TabBar } from '@/features/shell/tab-bar';
import { useVendor } from '@/features/vendor/context';

const ICONS = {
  index: 'home-outline',
  new: 'camera-outline',
  pieces: 'shirt-outline',
  ready: 'cube-outline',
  money: 'cash-outline',
} as const;

/** Vendor mode's five tabs (D-103): Home · Add a piece · My pieces · Keep ready · Money, in the shop's language. */
export default function VendorTabs(): React.JSX.Element {
  const { w } = useVendor();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} icons={ICONS} badgeLabel={(n) => String(n)} />}>
      <Tabs.Screen name="index" options={{ title: 'IWC' }} />
      <Tabs.Screen name="new" options={{ title: w('add_piece') }} />
      <Tabs.Screen name="pieces" options={{ title: w('my_pieces') }} />
      <Tabs.Screen name="ready" options={{ title: w('keep_ready') }} />
      <Tabs.Screen name="money" options={{ title: w('money') }} />
    </Tabs>
  );
}

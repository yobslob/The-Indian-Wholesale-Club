import { Text, View } from 'react-native';

import { isDemoStore } from '@repo/db/store';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * The demo round (D-078), as on the website: while the store shows the demo catalogue, Home and checkout say so.
 * Nothing is for sale and payments run in Stripe's test mode.
 */
export function DemoBanner(): React.JSX.Element | null {
  const { data: demo } = useQuery('demo-store', () => isDemoStore(supabase));
  if (!demo) return null;
  return (
    <View accessibilityRole="text" className="bg-ink rounded-md px-4 py-2.5">
      <Text className="font-ui text-canvas text-[13px] leading-5">
        Demo store. Nothing here is for sale and no real money is taken. To try checkout, pay with the test card 4242
        4242 4242 4242, any future date and any CVC.
      </Text>
    </View>
  );
}

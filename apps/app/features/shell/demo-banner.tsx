import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { isDemoStore } from '@repo/db/store';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const TEST_CARD = 'Pay with the test card 4242 4242 4242 4242, any future date and any CVC.';

/**
 * The demo round (D-078), as on the website: while the store shows the demo catalogue, Home and checkout say so.
 * Nothing is for sale and payments run in Stripe's test mode. `strip` is the website's short phone line on the top of
 * the Home photo (D-079, D-095), with the test card one tap away; otherwise a box in the page.
 */
export function DemoBanner({ strip = false }: { strip?: boolean }): React.JSX.Element | null {
  const { data: demo } = useQuery('demo-store', () => isDemoStore(supabase));
  const [card, setCard] = useState(false);
  if (!demo) return null;
  if (strip) {
    return (
      <View accessibilityRole="text" className="bg-ink px-3 py-[7px]">
        <Text className="font-ui text-canvas text-center text-xs leading-[17px]">
          <Text className="font-ui-semibold">Demo store.</Text> Nothing here is for sale.{' '}
          {card ? (
            TEST_CARD
          ) : (
            <Text accessibilityRole="button" onPress={() => setCard(true)} className="underline">
              Test card
            </Text>
          )}
        </Text>
      </View>
    );
  }
  return (
    <Pressable accessibilityRole="text" className="bg-ink rounded-md px-4 py-2.5">
      <Text className="font-ui text-canvas text-[13px] leading-5">Demo store. Nothing here is for sale and no real money is taken. {TEST_CARD}</Text>
    </Pressable>
  );
}

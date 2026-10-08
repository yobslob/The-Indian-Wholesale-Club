import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import tokens from '@repo/tokens';

import { Screen } from '@/components/ui';
import { AddressCards, OrderCards, YourDetails } from '@/features/account/profile-sections';
import { SignInCard } from '@/features/auth/sign-in-card';
import { HelpSheet } from '@/features/info/help-sheet';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type Section = 'orders' | 'addresses' | 'details';
const SECTIONS: [Section, string][] = [
  ['orders', 'Orders'],
  ['addresses', 'Addresses'],
  ['details', 'Your details'],
];

function LinkRow({ label, onPress, muted }: { label: string; onPress: () => void; muted?: boolean }): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="border-line min-h-[52px] flex-row items-center justify-between border-b">
      <Text className={`font-ui text-[15px] ${muted ? 'text-ink-muted' : 'text-ink'}`}>{label}</Text>
      {muted ? null : <Ionicons name="chevron-forward" size={18} color={tokens.colors['ink-muted']} />}
    </Pressable>
  );
}

/**
 * The Profile tab (D-089, D-091, D-095). Signed in: pill tabs Orders · Addresses · Your details (Saved is its own
 * tab), then Track an order, About us & help, Sign out. Signed out: the sign-in card and the same links. No admin
 * entry point anywhere (D-006); a server-confirmed admin who chose "View the store" sees "Back to admin".
 */
export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, isAdmin, setViewingStore } = useSession();
  const [section, setSection] = useState<Section>('orders');
  const [help, setHelp] = useState(false);
  const links = (
    <View className="border-line border-t">
      <LinkRow label="Track an order" onPress={() => router.push('/order/lookup')} />
      <LinkRow label="About us & help" onPress={() => setHelp(true)} />
      {session && isAdmin ? <LinkRow label="Back to admin" onPress={() => setViewingStore(false)} /> : null}
      {session ? <LinkRow label="Sign out" muted onPress={() => void supabase.auth.signOut()} /> : null}
    </View>
  );

  return (
    <Screen back={false} title="Profile">
      {session ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
            {SECTIONS.map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: section === key }}
                onPress={() => setSection(key)}
                className={`min-h-[42px] justify-center rounded-pill border px-4 ${section === key ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
              >
                <Text className={`font-ui text-sm ${section === key ? 'text-paper' : 'text-ink'}`}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {section === 'orders' ? <OrderCards userId={session.user.id} /> : null}
          {section === 'addresses' ? <AddressCards userId={session.user.id} /> : null}
          {section === 'details' ? <YourDetails userId={session.user.id} email={session.user.email ?? ''} /> : null}
        </>
      ) : (
        <SignInCard />
      )}
      {links}
      <HelpSheet open={help} onClose={() => setHelp(false)} />
    </Screen>
  );
}

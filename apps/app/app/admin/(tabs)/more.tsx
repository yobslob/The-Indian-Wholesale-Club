import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import tokens from '@repo/tokens';

import { Body, Screen } from '@/components/ui';
import { AdminHead } from '@/features/admin/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

function Row({ label, onPress, muted = false }: { label: string; onPress: () => void; muted?: boolean }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="border-line min-h-[54px] flex-row items-center gap-2.5 border-b">
      <Text className={`flex-1 text-[15px] ${muted ? 'font-ui text-ink-muted' : 'font-ui-semibold text-ink'}`}>{label}</Text>
      {muted ? null : <Ionicons name="chevron-forward" size={18} color={tokens.colors['ink-muted']} />}
    </Pressable>
  );
}

/** More (D-097): View the store, Sign out. The catalog-wide sections stay on the web panel. */
export default function MoreScreen(): React.JSX.Element {
  const { session, setViewingStore } = useSession();
  return (
    <Screen back={false}>
      <AdminHead title="More" />
      <View>
        <Row label="View the store" onPress={() => setViewingStore(true)} />
        <Row label="Sign out" muted onPress={() => void supabase.auth.signOut()} />
      </View>
      <Body muted>Signed in as {session?.user.email ?? ''}.</Body>
      <Body muted>Products, Regions, Reviews, Returns, Customers, Promotions, Insights and Settings are on the web panel.</Body>
    </Screen>
  );
}

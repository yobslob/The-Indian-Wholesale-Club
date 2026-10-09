import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { getWaitingCounts } from '@repo/db/admin';
import tokens from '@repo/tokens';

import type { Href } from 'expo-router';

import { Body, Screen } from '@/components/ui';
import { AdminHead, Chip } from '@/features/admin/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

function Row({ label, onPress, chip, muted = false }: { label: string; onPress: () => void; chip?: string; muted?: boolean }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="border-line min-h-[54px] flex-row items-center gap-2.5 border-b">
      <Text className={`flex-1 text-[15px] ${muted ? 'font-ui text-ink-muted' : 'font-ui-semibold text-ink'}`}>{label}</Text>
      {chip ? <Chip tone="warn">{chip}</Chip> : null}
      {muted ? null : <Ionicons name="chevron-forward" size={18} color={tokens.colors['ink-muted']} />}
    </Pressable>
  );
}

/** More (D-097): Payouts, Vendors, View the store, Sign out. The catalog-wide sections stay on the web panel. */
export default function MoreScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, setViewingStore } = useSession();
  const { data: counts } = useQuery('admin:waiting', () => getWaitingCounts(supabase));
  const go = (href: Href) => () => router.push(href);
  return (
    <Screen back={false}>
      <AdminHead title="More" />
      <View>
        <Row label="Payouts" chip={counts?.shopsOwed ? `${counts.shopsOwed} owed` : undefined} onPress={go('/admin/payouts')} />
        <Row label="Vendors" onPress={go('/admin/vendors')} />
        <Row label="View the store" onPress={() => setViewingStore(true)} />
        <Row label="Sign out" muted onPress={() => void supabase.auth.signOut()} />
      </View>
      <Body muted>Signed in as {session?.user.email ?? ''}.</Body>
      <Body muted>Products, Regions, Reviews, Returns, Customers, Promotions, Insights and Settings are on the web panel.</Body>
    </Screen>
  );
}

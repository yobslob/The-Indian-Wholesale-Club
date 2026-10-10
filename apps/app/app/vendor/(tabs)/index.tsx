import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { vendorKeepReady, vendorMoney, vendorPieces } from '@repo/db/vendor';
import { formatRupees, LANGUAGE_CODES, LANGUAGES } from '@repo/shared/vendor';
import tokens from '@repo/tokens';

import { Button, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

function Tile({ icon, title, hint, value, primary, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; value?: string; primary?: boolean; onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className={`min-h-24 flex-row items-center gap-4 rounded-lg border p-4 ${primary ? 'border-brand bg-brand' : 'border-line bg-paper'}`}>
      <Ionicons name={icon} size={32} color={primary ? tokens.colors['on-brand'] : tokens.colors.ink} />
      <View className="flex-1">
        <Text className={`font-heading text-[20px] ${primary ? 'text-on-brand' : 'text-ink'}`}>{title}</Text>
        <Text className={`font-body text-[14px] ${primary ? 'text-on-brand' : 'text-ink-muted'}`}>{hint}</Text>
      </View>
      {value ? <Text className={`font-ui text-[22px] ${primary ? 'text-on-brand' : 'text-ink'}`}>{value}</Text> : null}
    </Pressable>
  );
}

/** Vendor Home (D-103): four big tiles, the language switch and Sign out. */
export default function VendorHome(): React.JSX.Element {
  const router = useRouter();
  const { me, lang, setLang, w } = useVendor();
  const { data, loading, reload } = useQuery('vendor:home', async () => {
    const [ready, money, pieces] = await Promise.all([vendorKeepReady(supabase), vendorMoney(supabase), vendorPieces(supabase, 0, 50)]);
    return {
      toKeep: ready.reduce((n, r) => n + r.quantity, 0),
      owed: money.owed_paise,
      retakes: pieces.items.filter((p) => p.kind === 'submission' && p.status === 'needs_retake').length,
    };
  });
  return (
    <Screen back={false} title={w('hello', { name: me?.owner_name ?? me?.shop_name ?? '' })} refreshing={loading} onRefresh={reload}>
      <View className="flex-row flex-wrap gap-2">
        {LANGUAGE_CODES.map((code) => (
          <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: code === lang }} onPress={() => setLang(code)} className={`min-h-9 justify-center rounded-pill border px-3 ${code === lang ? 'border-ink bg-ink' : 'border-line bg-paper'}`}>
            <Text className={`font-ui text-[13px] ${code === lang ? 'text-paper' : 'text-ink'}`}>{LANGUAGES[code].name}</Text>
          </Pressable>
        ))}
      </View>
      <Tile icon="camera-outline" title={w('add_piece')} hint={w('add_piece_hint')} primary onPress={() => router.push('/vendor/new')} />
      <Tile icon="cube-outline" title={w('keep_ready')} hint={w('keep_ready_hint')} value={data?.toKeep ? String(data.toKeep) : undefined} onPress={() => router.push('/vendor/ready')} />
      <Tile icon="shirt-outline" title={w('my_pieces')} hint={data?.retakes ? w('status_needs_retake') : w('my_pieces_hint')} value={data?.retakes ? String(data.retakes) : undefined} onPress={() => router.push('/vendor/pieces')} />
      <Tile icon="cash-outline" title={w('money')} hint={w('owed')} value={formatRupees(data?.owed ?? 0)} onPress={() => router.push('/vendor/money')} />
      <Button kind="link" label={w('sign_out')} onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMyDesk } from '@repo/db/admin';
import { deskTime, type Desk, type Tone } from '@repo/shared/admin';
import tokens from '@repo/tokens';

import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * The app's admin mode in the approved look (D-097, on the web admin's D-096): plain chips, ink buttons, paper panels,
 * a search button on every tab root, sheets for the main actions. Times in the admin's desk zone.
 */

const TONE: Record<Tone, [string, string, string]> = {
  ok: ['bg-[rgba(22,101,52,0.1)]', 'text-positive', tokens.colors.positive],
  warn: ['bg-[rgba(138,90,0,0.12)]', 'text-caution', tokens.colors.caution],
  bad: ['bg-[rgba(185,28,28,0.1)]', 'text-danger', tokens.colors.danger],
  brand: ['bg-[rgba(122,46,35,0.1)]', 'text-brand', tokens.colors.brand],
  blue: ['bg-[rgba(30,64,120,0.1)]', 'text-[#1e4078]', '#1e4078'],
  mute: ['bg-surface', 'text-ink-muted', tokens.colors['ink-muted']],
};

export function Chip({ tone = 'mute', children }: { tone?: Tone; children: string }): React.JSX.Element {
  const [bg, text, dot] = TONE[tone];
  return (
    <View className={`h-[22px] flex-row items-center gap-[5px] self-start rounded-pill px-2 ${bg}`}>
      <View className="h-1.5 w-1.5 rounded-full opacity-70" style={{ backgroundColor: dot }} />
      <Text className={`font-ui-semibold text-[11.5px] ${text}`}>{children}</Text>
    </View>
  );
}

export function StatusChip<K extends string>({ map, status }: { map: Record<K, [string, Tone]>; status: K }): React.JSX.Element {
  const [label, tone] = map[status] ?? [status, 'mute'];
  return <Chip tone={tone}>{label}</Chip>;
}

/** A tab root's head: the large title and the search button that opens quick find (D-097). */
export function AdminHead({ title, code = false }: { title: string; code?: boolean }): React.JSX.Element {
  const router = useRouter();
  return (
    <View className="-mr-2 flex-row items-center gap-2">
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className={code ? 'font-ui-semibold text-ink flex-1 text-[20px]' : 'font-heading text-ink flex-1 text-[28px] leading-[31px] tracking-[-0.3px]'}
      >
        {title}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Find" onPress={() => router.push('/admin/find')} className="h-11 w-11 items-center justify-center">
        <Ionicons name="search-outline" size={22} color={tokens.colors.ink} />
      </Pressable>
    </View>
  );
}

/** Small uppercase label above a group (the desks, Products / Orders in find). */
export function Group({ children }: { children: string }): React.JSX.Element {
  return <Text className="font-ui-semibold text-ink-muted text-[10.5px] uppercase tracking-[1.5px]">{children}</Text>;
}

export function Panel({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View className="border-line bg-paper gap-2.5 rounded-[14px] border px-3.5 py-3">
      {title ? (
        <View className="flex-row items-center gap-2">
          <Text accessibilityRole="header" className="font-heading-semibold text-ink flex-1 text-[15px]">
            {title}
          </Text>
          {note ? <Text className="font-ui text-ink-muted text-[12px]">{note}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** The admin's buttons: ink for the main action, paper for the others, red-bordered for money that leaves. */
export function AdminButton({
  label,
  onPress,
  disabled,
  kind = 'primary',
  icon,
  big = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  big?: boolean;
}): React.JSX.Element {
  const look = kind === 'primary' ? 'bg-ink border-ink' : kind === 'danger' ? 'bg-paper border-[rgba(185,28,28,0.35)]' : 'bg-paper border-line';
  const color = kind === 'primary' ? tokens.colors.paper : kind === 'danger' ? tokens.colors.danger : tokens.colors.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`flex-row items-center justify-center gap-1.5 rounded-xl border px-3.5 ${big ? 'min-h-[50px]' : 'min-h-11'} ${look} ${disabled ? 'opacity-50' : ''}`}
    >
      {icon ? <Ionicons name={icon} size={17} color={color} /> : null}
      <Text className="font-ui-semibold text-[15px]" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A sheet from the bottom (Pack & ship, Record payout, Add a vendor): dimmed page, a handle, its own scroll. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="flex-1 bg-[rgba(20,17,15,0.4)]" />
        <View className="bg-canvas max-h-[86%] rounded-t-[22px]">
          {/* Shrinks to the sheet's height so a long form scrolls inside it. */}
          <SafeAreaView edges={['bottom']} className="shrink">
            <ScrollView className="shrink grow-0" contentContainerClassName="gap-3 px-4 pb-6 pt-2.5" keyboardShouldPersistTaps="handled">
              <View className="bg-line mb-1 h-1 w-10 self-center rounded-sm" />
              <Text accessibilityRole="header" className="font-heading-semibold text-ink text-[20px] leading-6">
                {title}
              </Text>
              {children}
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The signed-in admin's desk (D-007), which orders Today and sets the zone times are shown in. */
export function useDesk(): Desk | null {
  const { session } = useSession();
  const id = session?.user.id ?? '';
  const { data } = useQuery(`admin:desk:${id}`, () => (id ? getMyDesk(supabase, id) : Promise.resolve(null)));
  return data ?? null;
}

/** "Oct 8, 6:08 PM · 9:38 AM ET": a time in the desk's zone with the other beside it, never UTC (D-096). */
export function when(iso: string | null | undefined, desk: Desk | null): string {
  if (!iso) return '—';
  const t = deskTime(iso, desk);
  return `${t.main} · ${t.other}`;
}

/** A sheet that asks first (D-096's confirm rule): what happens, then the one button that does it. */
export function ConfirmSheet({
  open,
  title,
  children,
  confirm,
  onConfirm,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}): React.JSX.Element {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Text className="font-body text-ink-muted text-[14px] leading-5">{children}</Text>
      <AdminButton big label={busy ? 'Working…' : confirm} disabled={busy} onPress={onConfirm} />
      <AdminButton big kind="secondary" label="Not yet" onPress={onClose} />
    </Sheet>
  );
}

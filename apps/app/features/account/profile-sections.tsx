import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { deleteMyAddress, getMyProfile, listMyAddresses, setDefaultAddress, updateMyProfile } from '@repo/db/account';
import { listMyOrderCards } from '@repo/db/store';
import { CUSTOMER_STATUS_LABEL, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { Photo } from '@/components/photo';
import { Body, Button, ErrorText, Field, Loading } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const placed = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Orders as cards (D-089): the first piece's photo with "+n", number, placed date and window, status label, total. */
export function OrderCards({ userId }: { userId: string }): React.JSX.Element {
  const router = useRouter();
  const { data, error, loading } = useQuery(`order-cards:${userId}`, () => listMyOrderCards(supabase));
  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data && loading) return <Loading />;
  if (!data || data.length === 0) return <Body muted>No orders yet.</Body>;
  return (
    <View className="gap-2.5">
      {data.map((o) => {
        const open = !['delivered', 'cancelled', 'refunded'].includes(o.customer_status);
        const window = open && o.est_delivery_from && o.est_delivery_to ? ` · arrives ${formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}` : '';
        return (
          <Pressable
            key={o.id}
            accessibilityRole="link"
            accessibilityLabel={`Order ${o.order_number}, ${CUSTOMER_STATUS_LABEL[o.customer_status]}, ${formatUsd(o.total_cents)}`}
            onPress={() => router.push({ pathname: '/order/[number]', params: { number: o.order_number } })}
            className="border-line bg-paper flex-row items-center gap-3 rounded-[20px] border p-3"
          >
            <View>
              <View className="bg-land aspect-[3/4] w-[60px] overflow-hidden rounded-[10px]">{o.first_image_path ? <Photo path={o.first_image_path} width={60} /> : null}</View>
              {o.more_pieces > 0 ? (
                <View className="bg-ink absolute -bottom-1.5 -right-1.5 rounded-pill px-1.5 py-[3px]">
                  <Text className="font-ui-semibold text-paper text-[11px]">+{o.more_pieces}</Text>
                </View>
              ) : null}
            </View>
            <View className="flex-1">
              <Text className="font-ui-semibold text-ink text-[13px]">{o.order_number}</Text>
              <Text className="font-ui text-ink-muted text-xs">
                Placed {placed.format(new Date(o.created_at))}
                {window}
              </Text>
              <View className={`mt-1.5 self-start rounded-pill px-2 py-1 ${o.customer_status === 'delivered' ? 'bg-[rgba(22,101,52,0.12)]' : 'bg-surface'}`}>
                <Text className={`font-ui-semibold text-[11px] ${o.customer_status === 'delivered' ? 'text-positive' : 'text-ink'}`}>{CUSTOMER_STATUS_LABEL[o.customer_status]}</Text>
              </View>
            </View>
            <Text className="font-ui-semibold text-ink text-sm">{formatUsd(o.total_cents)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Addresses (D-089): cards with Default or Make default, and a pencil and a minus in the card's corner. */
export function AddressCards({ userId }: { userId: string }): React.JSX.Element {
  const router = useRouter();
  const { data, error, loading, reload } = useQuery(`addresses:${userId}`, () => listMyAddresses(supabase));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const run = async (task: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setActionError(null);
    try {
      await task();
      reload();
    } catch {
      setActionError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View className="gap-2.5">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>No saved addresses yet.</Body> : null}
      {data?.map((a) => {
        const name = a.label ?? a.full_name;
        return (
          <View key={a.id} className="border-line bg-paper gap-1.5 rounded-lg border py-4 pl-4 pr-24">
            <View className="flex-row items-center gap-2">
              <Text className="font-ui-semibold text-ink text-[15px]">{name}</Text>
              {a.is_default ? (
                <View className="bg-surface rounded-pill px-2 py-[3px]">
                  <Text className="font-ui-semibold text-ink-muted text-[11px]">Default</Text>
                </View>
              ) : null}
            </View>
            <Text className="font-body text-ink-muted text-sm leading-5">{[a.full_name, [a.line1, a.line2].filter(Boolean).join(', '), `${a.city}, ${a.state} ${a.zip_code}`].join('\n')}</Text>
            {!a.is_default ? (
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(() => setDefaultAddress(supabase, userId, a.id))} className="border-line bg-canvas mt-1.5 min-h-10 justify-center self-start rounded-pill border px-3.5">
                <Text className="font-ui text-ink text-[13px]">Make default</Text>
              </Pressable>
            ) : null}
            <View className="absolute right-2 top-2 flex-row gap-1">
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${name}`} onPress={() => router.push({ pathname: '/addresses', params: { id: a.id } })} className="h-10 w-10 items-center justify-center rounded-full">
                <Ionicons name="pencil-outline" size={18} color={tokens.colors.ink} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${name}`} disabled={busy} onPress={() => void run(() => deleteMyAddress(supabase, a.id))} className="h-10 w-10 items-center justify-center rounded-full">
                <Ionicons name="remove" size={20} color={tokens.colors.ink} />
              </Pressable>
            </View>
          </View>
        );
      })}
      {actionError ? <ErrorText>{actionError}</ErrorText> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push('/addresses')} className="border-ink-muted min-h-12 items-center justify-center self-start rounded-pill border border-dashed px-5">
        <Text className="font-ui-semibold text-ink text-sm">+ Add an address</Text>
      </Pressable>
    </View>
  );
}

/** Your details (D-089): the email as signed in, full name and phone, Save. */
export function YourDetails({ userId, email }: { userId: string; email: string }): React.JSX.Element {
  const { data } = useQuery(`profile:${userId}`, () => getMyProfile(supabase, userId));
  const [fullName, setFullName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'saved' | 'error'>('idle');
  const name = fullName ?? data?.full_name ?? '';
  const tel = phone ?? data?.phone ?? '';
  return (
    <View className="gap-3.5">
      <View className="gap-1.5">
        <Text className="font-ui text-ink text-[13px]">Email</Text>
        <Text className="border-line font-ui text-ink-muted min-h-12 rounded-md border px-3.5 py-3 text-[15px]">{data?.email ?? email}</Text>
      </View>
      <Field label="Full name" value={name} onChangeText={setFullName} autoComplete="name" textContentType="name" />
      <Field label="Phone" value={tel} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      {state === 'error' ? <ErrorText>Could not save. Please try again.</ErrorText> : null}
      {state === 'saved' ? <Text className="font-ui text-positive text-sm">Saved.</Text> : null}
      <Button
        label="Save"
        disabled={state === 'busy'}
        onPress={() => {
          setState('busy');
          void updateMyProfile(supabase, userId, { full_name: name.trim() || null, phone: tel.trim() || null })
            .then(() => setState('saved'))
            .catch(() => setState('error'));
        }}
      />
    </View>
  );
}

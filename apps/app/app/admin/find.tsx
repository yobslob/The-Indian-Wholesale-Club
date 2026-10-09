import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { adminQuickFind } from '@repo/db/admin';
import { ORDER_STATUS, PRODUCT_STATUS } from '@repo/shared/admin';
import tokens from '@repo/tokens';

import type { Href } from 'expo-router';

import { Photo } from '@/components/photo';
import { Body, Screen } from '@/components/ui';
import { Group, StatusChip } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';

type Found = Awaited<ReturnType<typeof adminQuickFind>>;

function Hit({ title, sub, href, lead, children }: { title: string; sub?: string; href: Href; lead?: React.ReactNode; children?: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button" className="border-line min-h-12 flex-row items-center gap-2.5 border-b py-2">
      {lead}
      <Text numberOfLines={1} className="font-body text-ink flex-1 text-[14px]">
        {title}
        {sub ? <Text className="text-ink-muted"> · {sub}</Text> : null}
      </Text>
      {children ? <View>{children}</View> : null}
    </Pressable>
  );
}

/**
 * Quick find (D-097, as the web's Ctrl+K): orders by number, name or email, products, customers and shops. Admin only
 * (RLS); five of each.
 */
export default function FindScreen(): React.JSX.Element {
  const [words, setWords] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (words.trim().length < 2) return setFound(null);
    let live = true;
    const timer = setTimeout(() => {
      void adminQuickFind(supabase, words).then((r) => live && setFound(r));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [words]);
  const none = found && !found.orders.length && !found.products.length && !found.customers.length && !found.vendors.length;

  return (
    <Screen title="Find">
      <TextInput
        autoFocus
        value={words}
        onChangeText={setWords}
        placeholder="Order number, name, email, product or shop"
        placeholderTextColor={tokens.colors['ink-muted']}
        accessibilityLabel="Find"
        returnKeyType="search"
        className="border-ink bg-paper text-ink font-ui min-h-11 rounded-xl border-[1.5px] px-3.5 text-[16px]"
      />
      {none ? <Body muted>Nothing found for “{words.trim()}”.</Body> : null}
      {found?.products.length ? (
        <View>
          <Group>Products</Group>
          {found.products.map((p) => {
            const main = p.media.find((m) => m.is_primary) ?? p.media[0];
            return (
              <Hit
                key={p.id}
                title={p.name}
                sub={p.region?.name}
                href={{ pathname: '/admin/listings', params: { view: p.status } }}
                lead={<View className="bg-land h-10 w-[30px] overflow-hidden rounded-md">{main ? <Photo path={main.storage_path} width={30} /> : null}</View>}
              >
                <StatusChip map={PRODUCT_STATUS} status={p.status} />
              </Hit>
            );
          })}
        </View>
      ) : null}
      {found?.orders.length ? (
        <View>
          <Group>Orders</Group>
          {found.orders.map((o) => (
            <Hit
              key={o.id}
              title={o.order_number}
              sub={(o.shipping_address as { fullName?: string } | null)?.fullName ?? o.email}
              href={{ pathname: '/admin/order/[id]', params: { id: o.id } }}
            >
              <StatusChip map={ORDER_STATUS} status={o.status} />
            </Hit>
          ))}
        </View>
      ) : null}
      {found?.customers.length ? (
        <View>
          <Group>Customers</Group>
          {found.customers.map((c) => (
            <Hit key={c.id} title={c.full_name || c.email || 'Customer'} sub={c.full_name ? (c.email ?? '') : 'their orders'} href={{ pathname: '/admin/orders', params: { q: c.email ?? '' } }} />
          ))}
        </View>
      ) : null}
      {found?.vendors.length ? (
        <View>
          <Group>Vendors</Group>
          {found.vendors.map((v) => (
            <Hit key={v.id} title={v.shop_name} sub={[v.town, v.region?.name].filter(Boolean).join(' · ')} href="/admin/vendors" />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

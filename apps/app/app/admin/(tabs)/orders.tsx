import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text } from 'react-native';

import { listAdminOrders } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Body, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { utc } from '@/features/admin/format';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const FILTERS: (Enum<'order_status'> | 'all')[] = [
  'all',
  'confirmed',
  'collecting',
  'in_transit',
  'arrived',
  'shipped',
  'delivered',
  'cancelled',
];

/** All orders, newest first, filtered by status (the US desk packs and ships from here). */
export default function AdminOrdersScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const status = FILTERS.find((f) => f === params.status) ?? 'all';
  const { data, error, loading, reload } = useQuery(`admin:orders:${status}`, () =>
    listAdminOrders(supabase, status === 'all' ? {} : { status }),
  );

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <Title>Orders</Title>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => router.setParams({ status: f })}
            className={`min-h-11 justify-center rounded-sm border px-3 ${f === status ? 'border-ink' : 'border-line'}`}
          >
            <Text className={f === status ? 'text-ink text-sm' : 'text-ink-muted text-sm'}>
              {f.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>No orders.</Body> : null}
      {data?.map((o) => {
        const unavailable = o.items.filter((i) => i.status === 'unavailable').length;
        return (
          <Pressable
            key={o.id}
            onPress={() => router.push({ pathname: '/admin/order/[id]', params: { id: o.id } })}
            className="border-line min-h-11 gap-1 rounded-md border p-3"
          >
            <Text className="text-ink font-medium">
              {o.order_number} · {o.status}
            </Text>
            <Text className="text-ink-muted text-sm">
              {o.email} · {formatUsd(o.total_cents)} · {utc(o.created_at)}
            </Text>
            {unavailable > 0 ? (
              <Text className="text-caution text-sm">
                {unavailable} unavailable, to refund on the web panel
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

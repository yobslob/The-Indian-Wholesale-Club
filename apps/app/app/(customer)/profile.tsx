import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { listMyOrders } from '@repo/db/store';
import { CUSTOMER_STATUS_LABEL, formatUsd } from '@repo/shared/domain';

import { Body, Button, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Profile: sign-in, own orders, addresses. No admin entry point anywhere (D-006). */
export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { session, isAdmin, setViewingStore } = useSession();
  const { data, error, loading, reload } = useQuery(`orders:${session?.user.id ?? 'none'}`, () =>
    session ? listMyOrders(supabase) : Promise.resolve([]),
  );

  if (!session) {
    return (
      <Screen>
        <Title>Profile</Title>
        <Body muted>Sign in to see your orders and saved pieces.</Body>
        <Button label="Sign in" onPress={() => router.push('/auth/login')} />
        <Button kind="link" label="Create an account" onPress={() => router.push('/auth/signup')} />
        <Button kind="link" label="Track an order" onPress={() => router.push('/order/lookup')} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Profile</Title>
      <Body muted>{session.user.email ?? ''}</Body>
      <Heading>Your orders</Heading>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>No orders yet.</Body> : null}
      {data?.map((o) => (
        <Pressable
          key={o.id}
          onPress={() =>
            router.push({ pathname: '/order/[number]', params: { number: o.order_number } })
          }
          className="border-line min-h-11 gap-1 rounded-md border p-3"
        >
          <Text className="text-ink font-medium">{o.order_number}</Text>
          <Text className="text-ink-muted text-sm">
            {date.format(new Date(o.created_at))} · {CUSTOMER_STATUS_LABEL[o.customer_status]} ·{' '}
            {formatUsd(o.total_cents)}
          </Text>
        </Pressable>
      ))}
      <Button kind="link" label="Addresses" onPress={() => router.push('/addresses')} />
      {/* Rendered only for a server-confirmed admin who chose "View the store" (D-006). */}
      {isAdmin ? (
        <Button kind="link" label="Back to admin" onPress={() => setViewingStore(false)} />
      ) : null}
      <Button kind="link" label="Sign out" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

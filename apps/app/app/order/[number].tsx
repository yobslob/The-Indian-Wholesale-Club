import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';

import { getMyOrder } from '@repo/db/store';

import { Body, Button, ErrorText, Loading, Screen } from '@/components/ui';
import { OrderView } from '@/features/orders/order-view';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** A signed-in customer's own order (store_my_order returns null for anyone else's). */
export default function MyOrderScreen(): React.JSX.Element {
  const router = useRouter();
  const { number } = useLocalSearchParams<{ number: string }>();
  const { ready, session } = useSession();
  const { data, error, loading, reload } = useQuery(
    `order:${number}:${session?.user.id ?? ''}`,
    () => (session ? getMyOrder(supabase, number) : Promise.resolve(null)),
  );

  if (ready && !session)
    return <Redirect href={{ pathname: '/order/lookup', params: { number } }} />;

  return (
    <Screen title="Your order" refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data ? <OrderView order={data} onChanged={reload} /> : null}
      {data === null && !loading && !error ? (
        <>
          <Body>We could not find this order in your account.</Body>
          <Button
            kind="link"
            label="Track it with your email instead"
            onPress={() => router.replace({ pathname: '/order/lookup', params: { number } })}
          />
        </>
      ) : null}
    </Screen>
  );
}

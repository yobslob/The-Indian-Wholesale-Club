import { useRouter } from 'expo-router';

import { listSavedProducts } from '@repo/db/account';

import { Body, Button, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Saved products (the account's wishlist, shared with the website). */
export default function SavedScreen(): React.JSX.Element {
  const router = useRouter();
  const { session } = useSession();
  const { data, error, loading, reload } = useQuery(`saved:${session?.user.id ?? 'none'}`, () =>
    session ? listSavedProducts(supabase) : Promise.resolve([]),
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Saved</Title>
      {!session ? (
        <>
          <Body muted>Sign in to keep the pieces you love, on the app and the website.</Body>
          <Button label="Sign in" onPress={() => router.push('/auth/login')} />
        </>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {session && !data && loading ? <Loading /> : null}
      {session && data && data.length === 0 ? <Body muted>Nothing saved yet.</Body> : null}
      {data && data.length > 0 ? (
        <Grid>
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Grid>
      ) : null}
    </Screen>
  );
}

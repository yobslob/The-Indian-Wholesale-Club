import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { listSavedProducts, unsaveProduct } from '@repo/db/account';
import tokens from '@repo/tokens';

import { Body, ErrorText, Loading, Screen } from '@/components/ui';
import { SignInCard } from '@/features/auth/sign-in-card';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * The Saved tab (D-089, D-095): the account's saved pieces (shared with the website) as the standard cards, each with
 * a filled heart on the photo that removes it. Signed out, the sign-in card.
 */
export default function SavedScreen(): React.JSX.Element {
  const { session } = useSession();
  const { data, error, loading, reload } = useQuery(`saved:${session?.user.id ?? 'none'}`, () =>
    session ? listSavedProducts(supabase) : Promise.resolve([]),
  );

  return (
    <Screen back={false} title="Saved" refreshing={loading} onRefresh={reload}>
      {!session ? <SignInCard why="Keep the pieces you love, on the app and the website." /> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {session && !data && loading ? <Loading /> : null}
      {session && data && data.length === 0 ? <Body muted>Nothing saved yet.</Body> : null}
      {session && data && data.length > 0 ? (
        <Grid>
          {data.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              corner={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${p.name} from saved`}
                  onPress={() => void unsaveProduct(supabase, p.id).then(reload)}
                  className="border-line bg-paper h-[38px] w-[38px] items-center justify-center rounded-full border"
                >
                  <Ionicons name="heart" size={18} color={tokens.colors.brand} />
                </Pressable>
              }
            />
          ))}
        </Grid>
      ) : null}
    </Screen>
  );
}

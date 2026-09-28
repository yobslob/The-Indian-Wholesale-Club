import { View } from 'react-native';

import { getHome } from '@repo/db/store';

import { Body, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { RegionCard } from '@/features/catalog/cards';
import { DeliveryNote } from '@/features/catalog/delivery-note';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** "Where's home?": all 36 regions + the next delivery window (one store_home() call). */
export default function HomeScreen(): React.JSX.Element {
  const { data, error, loading, reload } = useQuery('home', () => getHome(supabase));
  const live = data?.regions.filter((r) => r.is_live) ?? [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Where&apos;s home?</Title>
      {/* TODO(founder): approve the home copy (design.md voice, D-019). */}
      <Body muted>
        Pick your state and find the clothing and spices you grew up with, delivered in the US.
      </Body>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data ? (
        <>
          <DeliveryNote delivery={data.delivery} />
          {live.length > 0 ? (
            <View className="gap-2">
              <Heading>Available now</Heading>
              {live.map((r) => (
                <RegionCard key={r.slug} region={r} />
              ))}
            </View>
          ) : null}
          <View className="gap-2">
            <Heading>All of India</Heading>
            {data.regions.map((r) => (
              <RegionCard key={r.slug} region={r} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

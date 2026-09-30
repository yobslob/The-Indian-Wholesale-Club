import { RefreshControl, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getHome } from '@repo/db/store';

import { Body, ErrorText, Heading, Loading } from '@/components/ui';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { HomeHero, HomeTopBar } from '@/features/home/home-hero';
import { PickHome } from '@/features/regions/pick-home';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Home (storefront.md, design.md §Direction, D-050 – D-055): the photo hero, Just listed, Pick your home.
 * One store_home() call. The logo bar fades in as the hero words fade out.
 */
export default function HomeScreen(): React.JSX.Element {
  const { data, error, loading, reload } = useQuery('home', () => getHome(supabase));
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View className="bg-canvas flex-1">
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} progressViewOffset={insets.top} />}
      >
        <HomeHero scrollY={scrollY} />
        <View className="gap-6 px-4 pb-16 pt-8">
          {error ? <ErrorText>{error}</ErrorText> : null}
          {!data && loading ? <Loading /> : null}
          {data && data.just_listed.length > 0 ? (
            <View className="gap-4">
              <Heading>Just listed</Heading>
              <Grid>
                {data.just_listed.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </Grid>
            </View>
          ) : null}
          {data ? (
            <View className="gap-4 pt-4">
              <View className="gap-1">
                <Heading>Pick your home</Heading>
                <Body muted>All 28 states and 8 union territories. Find yours on the map or by name.</Body>
              </View>
              <PickHome regions={data.regions} delivery={data.delivery} />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
      <HomeTopBar scrollY={scrollY} topInset={insets.top} />
    </View>
  );
}

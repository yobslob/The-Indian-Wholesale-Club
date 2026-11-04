import { useRef } from 'react';
import { RefreshControl, View } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getHome } from '@repo/db/store';

import { Body, ErrorText, Heading, Loading } from '@/components/ui';
import { ProductRow } from '@/features/catalog/product-row';
import { CategoryTiles } from '@/features/home/category-tiles';
import { HomeHero, HomeTopBar } from '@/features/home/home-hero';
import { PickHome } from '@/features/regions/pick-home';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/**
 * Home (storefront.md, D-079, D-080, D-095, D-187), in the website's order: the photo hero with the name on its wall,
 * Shop by category, What everyone missed this week, The kirana counter, Just listed Clothing and Home & gifts, Pick
 * your home. One store_home() call. The logo bar fades in as the hero words fade out.
 */
export default function HomeScreen(): React.JSX.Element {
  const { data, error, loading, reload } = useQuery('home', () => getHome(supabase));
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const scroller = useAnimatedRef<Animated.ScrollView>();
  // Pick your home's place in the scroll: its offset in the content block plus the block's own (under the hero).
  const pickY = useRef(0);
  const blockY = useRef(0);

  return (
    <View className="bg-canvas flex-1">
      <Animated.ScrollView
        ref={scroller}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} progressViewOffset={insets.top} />}
      >
        <HomeHero
          scrollY={scrollY}
          onStart={() => scroller.current?.scrollTo({ y: blockY.current + pickY.current, animated: true })}
        />
        <View className="gap-6 px-4 pb-16 pt-8" onLayout={(e) => (blockY.current = e.nativeEvent.layout.y)}>
          {error ? <ErrorText>{error}</ErrorText> : null}
          {!data && loading ? <Loading /> : null}
          {data ? <CategoryTiles categories={data.categories} /> : null}
          {data ? <ProductRow title="What everyone missed this week" products={data.most_ordered} /> : null}
          {data ? <ProductRow title="The kirana counter" sub="Under $5" products={data.under_5} /> : null}
          {data ? <ProductRow title="Just listed Clothing" products={data.just_listed_types.clothing ?? []} seeAll={{ type: 'clothing' }} /> : null}
          {data ? <ProductRow title="Just listed Home & gifts" products={data.just_listed_types.home ?? []} seeAll={{ type: 'home' }} /> : null}
          {data ? (
            <View className="gap-4 pt-4" onLayout={(e) => (pickY.current = e.nativeEvent.layout.y)}>
              <View className="gap-1">
                <Heading>Pick your home</Heading>
                <Body muted>All 28 states and 8 union territories. Find yours on the map or by name.</Body>
              </View>
              <PickHome regions={data.regions} />
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>
      <HomeTopBar scrollY={scrollY} topInset={insets.top} />
    </View>
  );
}

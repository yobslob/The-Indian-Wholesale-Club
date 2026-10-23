import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { quickArrivesLine } from '@repo/shared/domain';
import tokens from '@repo/tokens';

/**
 * The store switch (D-154), as on the website: one pill, "IWC" and "7-day", the thumb on the store the shopper is in
 * (paper in the IWC store, the brand colour in the 7-day store) with the live date under "7-day" ("arrives by Fri, Oct
 * 30", from the 7-day days in Settings). The app has no shared header, so it sits at the top of Home and of the 7-day
 * screen. A tap glides the thumb (240 ms with a slight spring, a glow once; at once with reduced motion), then opens
 * the 7-day store, or goes back to the screen left. Screen readers get one tab list of two tabs.
 */
export function StoreSwitch({ store, daysMin, daysMax }: { store: 'iwc' | 'quick'; daysMin: number; daysMax: number }): React.JSX.Element {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const at = useSharedValue(store === 'quick' ? 1 : 0);
  const glow = useSharedValue(0);
  useEffect(() => {
    at.value = store === 'quick' ? 1 : 0;
  }, [store, at]);

  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: (at.value * (width - 6)) / 2 }],
    backgroundColor: at.value > 0.5 ? tokens.colors.brand : tokens.colors.paper,
    shadowOpacity: 0.14 + glow.value * 0.4,
    shadowRadius: 3 + glow.value * 9,
  }));

  const go = (to: 'iwc' | 'quick'): void => {
    if (to === store) return;
    const target = to === 'quick' ? 1 : 0;
    if (reduce) at.value = target;
    else {
      at.value = withSpring(target, { duration: 240, dampingRatio: 0.72 });
      glow.value = withSequence(withTiming(1, { duration: 240 }), withTiming(0, { duration: 600 }));
    }
    const open = (): void => {
      if (to === 'quick') router.push('/7-day-delivery');
      else if (router.canGoBack()) router.back();
      else router.replace('/');
      // this screen stays in its own store: the thumb is back in place when the shopper returns
      at.value = store === 'quick' ? 1 : 0;
      glow.value = 0;
    };
    setTimeout(open, reduce ? 0 : 200);
  };

  const tab = (to: 'iwc' | 'quick', name: string): React.JSX.Element => {
    const selected = store === to;
    const light = selected && to === 'quick';
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        aria-selected={selected}
        accessibilityLabel={to === 'quick' ? `7-day store, ${quickArrivesLine(daysMin, daysMax)}` : 'IWC store'}
        onPress={() => go(to)}
        className="flex-1 items-center justify-center"
      >
        <Text className={`font-ui-semibold text-[13px] ${light ? 'text-on-brand' : selected ? 'text-ink' : 'text-ink-muted'}`}>
          {name}
        </Text>
        {to === 'quick' ? (
          <Text className={`font-ui text-[10.5px] ${light ? 'text-on-brand' : 'text-ink-muted'}`}>
            {quickArrivesLine(daysMin, daysMax)}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="border-line h-11 flex-row rounded-pill border p-[3px]"
      style={{ backgroundColor: tokens.colors.surface }}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute bottom-[3px] left-[3px] top-[3px] rounded-pill"
        style={[{ width: width ? (width - 6) / 2 : 0, shadowColor: tokens.colors.brand, shadowOffset: { width: 0, height: 1 } }, thumb]}
      />
      {tab('iwc', 'IWC')}
      {tab('quick', '7-day')}
    </View>
  );
}

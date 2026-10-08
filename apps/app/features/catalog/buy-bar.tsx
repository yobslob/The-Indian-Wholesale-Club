import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface BuyBarState {
  name: string;
  detail: string;
  soldOut: boolean;
  added: boolean;
  add: () => void;
}

/**
 * The product's buy bar (D-082, D-095): the name, price · option and Add to bag, sliding up from the bottom once the
 * screen's own Add to bag has scrolled away above, and back down when it returns. It adds the same piece and quantity.
 */
export function BuyBar({
  state,
  shown,
}: {
  state: BuyBarState | null;
  shown: boolean;
}): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(120)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: shown ? 0 : 120,
      duration: 300,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [shown, y]);
  if (!state) return null;
  return (
    // NativeWind styles plain views only: the animated wrapper takes styles, the bar inside takes the classes.
    <Animated.View
      pointerEvents={shown ? 'auto' : 'none'}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: y }] }}
    >
      <View
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        className="bg-canvas border-line flex-row items-center gap-3 border-t px-4 pt-2.5"
      >
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-ui-semibold text-ink text-sm">
            {state.name}
          </Text>
          <Text className="font-ui text-ink-muted text-[13px]">{state.detail}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={state.soldOut}
          onPress={state.add}
          className={`bg-brand rounded-pill h-[46px] w-[140px] items-center justify-center ${state.soldOut ? 'opacity-50' : ''}`}
        >
          <Text className="font-ui-semibold text-on-brand text-[15px]">
            {state.added ? '✓ Added' : 'Add to bag'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

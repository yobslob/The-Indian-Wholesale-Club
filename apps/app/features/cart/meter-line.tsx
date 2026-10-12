import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import tokens from '@repo/tokens';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * The free-delivery pill's meter as a slim line under the bag's "Add $x more" (D-116): a brand fill with a glowing
 * edge that flares when the bag grows. Reduce motion: it simply sits at its place.
 */
export function MeterLine({ share }: { share: number }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  const flare = useSharedValue(0);
  const last = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const target = Math.max(share, 0.04);

  useEffect(() => {
    if (width === 0) return;
    const grew = last.current !== null && share > last.current + 0.001;
    last.current = share;
    if (reduce) {
      fill.value = target;
      return;
    }
    fill.value = withTiming(target, { duration: 1100, easing: EASE });
    if (grew) flare.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 1100, easing: EASE }));
  }, [width, share, target, reduce, fill, flare]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * width }));
  const edgeStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + flare.value * 0.25,
    transform: [{ translateX: fill.value * width - 7 }, { scale: 1 + flare.value * 0.8 }],
  }));

  return (
    <View
      className="bg-surface h-1.5 rounded-full"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View className="bg-brand absolute bottom-0 left-0 top-0 rounded-full" style={fillStyle} />
      <Animated.View className="absolute -top-1 h-3.5 w-3.5 items-center justify-center" style={edgeStyle}>
        <View className="absolute h-3.5 w-3.5 rounded-full" style={{ backgroundColor: 'rgba(255,190,140,0.35)' }} />
        <View className="h-2 w-2 rounded-full border border-white" style={{ backgroundColor: tokens.colors.brand }} />
      </Animated.View>
    </View>
  );
}

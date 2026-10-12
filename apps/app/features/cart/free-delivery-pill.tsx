import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { freeDelivery, useBagCharges } from './charges';
import { bagCount, useBag } from './store';

import { Photo } from '@/components/photo';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * The free-delivery pill (D-111, D-116), the website's in the app: above the tabs once a piece is in the bag. The
 * newest photo with the count, one line of text, a chevron; the pill itself is the meter: a soft light fills it from
 * the left with a glowing edge that breathes and flares each time the bag grows, and gives way to one sheen at the
 * line. A tap opens the Bag tab. Reduce motion: the fill simply sits at its place.
 */
export function FreeDeliveryBar({ onPress }: { onPress: () => void }): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  const visible = lines.length > 0 && charges !== null && charges.free_min_cents !== null;
  const { free, leftCents, share } = freeDelivery(lines, charges);
  const count = bagCount(lines);
  const newest = lines[lines.length - 1];
  const reduce = useReducedMotion();

  const [width, setWidth] = useState(0);
  const fill = useSharedValue(0);
  const flare = useSharedValue(0);
  const breathe = useSharedValue(1);
  const sheen = useSharedValue(-1);
  const pop = useSharedValue(1);
  const last = useRef<{ share: number; count: number } | null>(null);
  const target = free ? 1 : Math.max(share, 0.04);

  useEffect(() => {
    if (!visible || width === 0) return;
    const grew = last.current !== null && share > last.current.share + 0.001;
    const more = last.current !== null && count > last.current.count;
    last.current = { share, count };
    if (reduce) {
      fill.value = target;
      return;
    }
    fill.value = withTiming(target, { duration: 1100, easing: EASE });
    if (grew)
      flare.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 1100, easing: EASE }),
      );
    if (more)
      pop.value = withSequence(
        withTiming(0.5, { duration: 0 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      );
    if (free && grew)
      sheen.value = withSequence(
        withTiming(-1, { duration: 0 }),
        withDelay(400, withTiming(1, { duration: 1400 })),
      );
  }, [visible, width, target, share, count, free, reduce, fill, flare, pop, sheen]);

  useEffect(() => {
    if (reduce) return;
    breathe.value = withRepeat(
      withTiming(0.6, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduce, breathe]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * width }));
  const edgeStyle = useAnimatedStyle(() => ({
    opacity: free ? 0 : Math.max(breathe.value, flare.value),
    transform: [{ translateX: fill.value * width - 9 }, { scaleX: 1 + flare.value * 1.6 }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value * width }, { skewX: '-18deg' }],
  }));
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (!visible) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        free
          ? `Free delivery unlocked. Bag, ${count} items`
          : `Add ${formatUsd(leftCents)} more to unlock free delivery. Bag, ${count} items`
      }
      onPress={onPress}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="bg-brand rounded-pill mx-3 mb-2 h-14 flex-row items-center gap-3 overflow-hidden pl-2 pr-4 active:opacity-90"
      style={free ? { borderWidth: 1, borderColor: 'rgba(255,214,170,0.55)' } : undefined}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute bottom-0 left-0 top-0"
        style={fillStyle}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="fd" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFECD6" stopOpacity="0.03" />
              <Stop offset="1" stopColor="#FFECD6" stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fd)" />
        </Svg>
      </Animated.View>
      {/* The edge: a bright 2 pt line inside two soft halos, so it glows on Android too (no coloured shadows there). */}
      <Animated.View
        pointerEvents="none"
        className="absolute bottom-0 left-0 top-0 w-[18px] items-center"
        style={edgeStyle}
      >
        <View
          className="absolute bottom-0 top-0 w-[18px] rounded-full"
          style={{ backgroundColor: 'rgba(255,190,140,0.16)' }}
        />
        <View
          className="absolute bottom-0 top-0 w-[8px] rounded-full"
          style={{ backgroundColor: 'rgba(255,214,170,0.35)' }}
        />
        <View
          className="absolute bottom-0 top-0 w-[2px] rounded-full"
          style={{ backgroundColor: 'rgba(255,244,228,0.95)' }}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        className="absolute bottom-[-10px] top-[-10px] w-16"
        style={[{ backgroundColor: 'rgba(255,244,228,0.3)', left: 0 }, sheenStyle]}
      />
      <View className="bg-paper h-10 w-10 items-center justify-center rounded-full">
        <View className="absolute inset-0 overflow-hidden rounded-full">
          {newest?.imagePath ? <Photo path={newest.imagePath} width={40} /> : null}
        </View>
        {newest?.imagePath ? null : (
          <Ionicons name="bag-outline" size={18} color={tokens.colors.brand} />
        )}
        <Animated.View
          className="bg-ink border-brand absolute -right-1 -top-1 h-[20px] min-w-[20px] items-center justify-center rounded-full border-2 px-1"
          style={countStyle}
        >
          <Text className="font-ui-semibold text-paper text-[10px]">{count}</Text>
        </Animated.View>
      </View>
      <Text numberOfLines={1} className="font-ui text-on-brand flex-1 text-[13.5px]">
        {free ? (
          <>
            <Text className="font-ui-semibold">FREE DELIVERY</Text> unlocked
          </>
        ) : (
          <>
            Add <Text className="font-ui-semibold">{formatUsd(leftCents)}</Text> more for{' '}
            <Text className="font-ui-semibold">FREE DELIVERY</Text>
          </>
        )}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
    </Pressable>
  );
}

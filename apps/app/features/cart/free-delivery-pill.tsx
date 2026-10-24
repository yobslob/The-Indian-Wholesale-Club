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

import { formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { freeDelivery, useBagCharges } from './charges';
import { bagCount, useBag } from './store';

import { Photo } from '@/components/photo';

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * The free-delivery pill (D-111, D-116), the website's in the app: above the tabs once a piece is in the bag. The
 * newest photo with the count, one line of text with a bar under it that fills with light (a glowing head that
 * breathes and flares each time the bag grows, a shimmer running through the filled part), a chevron; at the line
 * the bar is full and one sheen crosses the pill. A tap opens the Bag tab. Reduce motion: the bar simply sits at its
 * place.
 */
export function FreeDeliveryBar({ onPress }: { onPress: () => void }): React.JSX.Element | null {
  const lines = useBag((s) => s.lines);
  const charges = useBagCharges();
  const visible = lines.length > 0 && charges !== null && charges.free_min_cents !== null;
  const { bulk, goal } = freeDelivery(lines, charges);
  // One goal, one bar (bag-goal.ts): a bag of only 7-day pieces works towards, then has, free 7-day delivery
  const free = goal.kind === 'free' || goal.kind === 'quick-free';
  const share = goal.kind === 'none' ? 0 : goal.kind === 'free' ? 1 : goal.share;
  const leftCents = goal.kind === 'quick-gap' || goal.kind === 'free-gap' ? goal.leftCents : 0;
  // D-119: past the line the bar shows the bulk saving filling up to its cap.
  const saving = goal.kind === 'free' && bulk.capCents > 0 && bulk.savingCents > 0;
  const count = bagCount(lines);
  const newest = lines[lines.length - 1];
  const reduce = useReducedMotion();

  const [width, setWidth] = useState(0); // the bar's
  const [pillWidth, setPillWidth] = useState(0);
  const fill = useSharedValue(0);
  const shimmer = useSharedValue(-1);
  const flare = useSharedValue(0);
  const breathe = useSharedValue(1);
  const sheen = useSharedValue(-1);
  const pop = useSharedValue(1);
  const last = useRef<{ share: number; count: number } | null>(null);
  const target = saving ? Math.max(bulk.share, 0.04) : free ? 1 : Math.max(share, 0.04);

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
    shimmer.value = withRepeat(
      withTiming(2.4, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withTiming(0.6, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [reduce, breathe, shimmer]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * width }));
  const headStyle = useAnimatedStyle(() => ({
    opacity: free ? 0 : Math.max(breathe.value, flare.value),
    transform: [{ translateX: fill.value * width - 9 }, { scale: 1 + flare.value * 1.4 }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * width * 0.45 }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value * pillWidth }, { skewX: '-18deg' }],
  }));
  const countStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  if (!visible) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        saving
          ? `Saving ${formatUsd(bulk.savingCents)}${bulk.capped ? ', the biggest saving' : ''}. Bag, ${count} items`
          : goal.kind === 'quick-free'
          ? `Free 7-day delivery${goal.arrivesBy ? `, arrives by ${goal.arrivesBy}` : ''}. Bag, ${count} items`
          : free
          ? `Free delivery unlocked. Bag, ${count} items`
          : goal.kind === 'quick-gap'
          ? `Add ${formatUsd(leftCents)} more for free 7-day delivery. Bag, ${count} items`
          : `Add ${formatUsd(leftCents)} more to unlock free delivery. Bag, ${count} items`
      }
      onPress={onPress}
      onLayout={(e) => setPillWidth(e.nativeEvent.layout.width)}
      className="bg-brand rounded-pill mx-3 mb-2 h-14 flex-row items-center gap-3 overflow-hidden pl-2 pr-4 active:opacity-90"
      style={free ? { borderWidth: 1, borderColor: 'rgba(255,214,170,0.55)' } : undefined}
    >
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
      <View className="flex-1 gap-[7px]">
        <Text numberOfLines={1} className="font-ui text-on-brand text-[13.5px] leading-[15px]">
          {saving && bulk.capped ? (
            <>
              <Text className="font-ui-semibold">{formatUsd(bulk.capCents)}</Text> off:{' '}
              <Text className="font-ui-semibold">BIGGEST SAVING</Text>
            </>
          ) : saving ? (
            <>
              Saving <Text className="font-ui-semibold">{formatUsd(bulk.savingCents)}</Text> · add more, save more
            </>
          ) : goal.kind === 'quick-free' ? (
            <>
              <Text className="font-ui-semibold">FREE 7-DAY DELIVERY</Text>
              {goal.arrivesBy ? ` · by ${goal.arrivesBy}` : ' unlocked'}
            </>
          ) : free ? (
            <>
              <Text className="font-ui-semibold">FREE DELIVERY</Text> unlocked
            </>
          ) : (
            <>
              Add <Text className="font-ui-semibold">{formatUsd(leftCents)}</Text> more for{' '}
              <Text className="font-ui-semibold">{goal.kind === 'quick-gap' ? 'FREE 7-DAY DELIVERY' : 'FREE DELIVERY'}</Text>
            </>
          )}
        </Text>
        {/* The bar: a track, the fill with a shimmer running through it, and the glowing head (two soft halos around a
          bright dot, so it glows on Android too, where shadows are not coloured). */}
        <View
          className="h-1 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          <Animated.View
            className="absolute bottom-0 left-0 top-0 overflow-hidden rounded-full"
            style={[{ backgroundColor: 'rgba(255,240,224,0.85)' }, fillStyle]}
          >
            <Animated.View
              className="absolute bottom-0 top-0 w-[45%]"
              style={[{ left: '-45%', backgroundColor: 'rgba(255,255,255,0.7)' }, shimmerStyle]}
            />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            className="absolute -top-[7px] h-[18px] w-[18px] items-center justify-center"
            style={headStyle}
          >
            <View
              className="absolute h-[18px] w-[18px] rounded-full"
              style={{ backgroundColor: 'rgba(255,190,140,0.25)' }}
            />
            <View
              className="absolute h-3 w-3 rounded-full"
              style={{ backgroundColor: 'rgba(255,214,170,0.45)' }}
            />
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: '#FFF4E4' }} />
          </Animated.View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
    </Pressable>
  );
}

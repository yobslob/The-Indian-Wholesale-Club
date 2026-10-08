import { Image, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import HERO from '../../assets/images/home-hero.webp';

import type { SharedValue } from 'react-native-reanimated';

import { DemoBanner } from '@/features/shell/demo-banner';

const WORDS = ['Indian', 'Wholesale', 'Club'] as const;
/** The photo's shape (1117 × 1409) and where its white wall starts (x 690 of 1117, its middle at y 502 of 1409). */
const AR = 1117 / 1409;
const WALL_X = 690 / 1117;
const WALL_Y = 502 / 1409;

/** How far the hero has scrolled, 0 at the top, 1 after 55 % of it (the same curve as the website). */
export function heroProgress(scrollY: number, heroHeight: number): number {
  'worklet';
  return Math.min(1, Math.max(0, scrollY / (heroHeight * 0.55)));
}

/**
 * The photo laid out as the website's `background-size: cover` at 85 % 20 % (D-079), and the name's place and size on
 * its white wall: right-aligned to the screen, centred on the wall's middle, never wider than the wall (the website's
 * --W/--H/--L/--T/--avail/--fs maths in home-hero.module.css).
 */
export function wall(width: number, height: number, gutter = 16) {
  const W = Math.max(width, height * AR);
  const H = W / AR;
  const L = (width - W) * 0.85;
  const T = (height - H) * 0.2;
  const avail = width - gutter - L - W * WALL_X;
  const size = Math.min((avail / 4.4) * 0.74, H * 0.057, 108);
  return { photo: { width: W, height: H, left: L, top: T }, centerY: T + H * WALL_Y, avail, size };
}

function Word({ word, index, size, scrollY, heroHeight }: { word: string; index: number; size: number; scrollY: SharedValue<number>; heroHeight: number }): React.JSX.Element {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const q = Math.min(1, Math.max(0, (heroProgress(scrollY.value, heroHeight) * 1.5 - index * 0.17) / 0.7));
    return { opacity: 1 - q, transform: [{ translateY: reduced ? 0 : -q * 22 }] };
  });
  return (
    <Animated.Text style={[style, { fontSize: size, lineHeight: size * 0.95, color: '#1D1A17' }]} className="font-display text-right">
      {word}
    </Animated.Text>
  );
}

/**
 * The Home hero (D-079, D-095): the founder's photo under the status bar, "Indian Wholesale Club" stacked on its white
 * wall in #1D1A17, and "Miss local market? Start here." under it; scrolling fades the words out one after another.
 * The demo banner rides on top of the photo. `onStart` goes to Pick your home.
 */
export function HomeHero({ scrollY, onStart }: { scrollY: SharedValue<number>; onStart: () => void }): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroHeight = Math.round(height * 0.9);
  const w = wall(width, heroHeight);
  const lineSize = Math.min(Math.max(12, w.size * 0.2), 18);
  const block = w.size * 0.95 * WORDS.length + w.size * 0.3 + lineSize * 1.35;
  return (
    <View style={{ height: heroHeight }} className="bg-ink overflow-hidden">
      <Image
        source={HERO}
        accessibilityLabel="A woman in a white embroidered suit and dupatta sits on a wooden bench in a hallway, her chin resting on her hand."
        style={{ position: 'absolute', ...w.photo }}
      />
      <View className="absolute left-0 right-0" style={{ top: insets.top }}>
        <DemoBanner strip />
      </View>
      <View
        className="absolute right-4 items-end"
        style={{ top: w.centerY - block / 2, maxWidth: w.avail }}
        accessibilityRole="header"
        accessibilityLabel="Indian Wholesale Club"
      >
        {WORDS.map((word, i) => (
          <Word key={word} word={word} index={i} size={w.size} scrollY={scrollY} heroHeight={heroHeight} />
        ))}
        <Text className="font-body text-right text-black" style={{ marginTop: w.size * 0.3, fontSize: lineSize, lineHeight: lineSize * 1.35 }}>
          Miss local market?{' '}
          <Text accessibilityRole="link" onPress={onStart} className="underline">
            Start here.
          </Text>
        </Text>
      </View>
    </View>
  );
}

/** The bar that fades in with the logo as the hero words fade out. */
export function HomeTopBar({ scrollY, topInset }: { scrollY: SharedValue<number>; topInset: number }): React.JSX.Element {
  const { height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.9);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress(scrollY.value, heroHeight), [0.4, 1], [0, 1], Extrapolation.CLAMP),
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[style, { paddingTop: topInset }]}
      className="bg-canvas border-line absolute left-0 right-0 top-0 border-b px-4 pb-3"
    >
      <Text className="font-logo text-ink text-[20px]">The Indian Wholesale Club</Text>
    </Animated.View>
  );
}

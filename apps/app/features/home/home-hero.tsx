import { Image, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, Extrapolation } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import tokens from '@repo/tokens';

import HERO from '../../assets/images/home-hero.webp';

import type { SharedValue } from 'react-native-reanimated';

const WORDS = ['The', 'Indian', 'Wholesale', 'Club'] as const;

/** How far the hero has scrolled, 0 at the top, 1 after 55 % of it (the same curve as the website). */
export function heroProgress(scrollY: number, heroHeight: number): number {
  'worklet';
  return Math.min(1, Math.max(0, scrollY / (heroHeight * 0.55)));
}

function Word({
  word,
  index,
  size,
  scrollY,
  heroHeight,
}: {
  word: string;
  index: number;
  size: number;
  scrollY: SharedValue<number>;
  heroHeight: number;
}): React.JSX.Element {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const q = Math.min(1, Math.max(0, (heroProgress(scrollY.value, heroHeight) * 1.5 - index * 0.17) / 0.7));
    return { opacity: 1 - q, transform: [{ translateY: reduced ? 0 : -q * 22 }] };
  });
  return (
    <Animated.Text
      style={[style, { fontSize: size, lineHeight: size * 0.95, letterSpacing: -size * 0.05 }]}
      className="font-display text-canvas text-right"
    >
      {word}
    </Animated.Text>
  );
}

/**
 * The Home hero (design.md §Direction, D-052 – D-055): the founder's photo (AI-generated, IWC holds the rights)
 * edge to edge; "The Indian Wholesale Club" stacked, right-aligned, over a soft dark fade at the bottom (the
 * phone layout of the website); scrolling fades the words out, one after another.
 */
export function HomeHero({ scrollY }: { scrollY: SharedValue<number> }): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.82);
  const size = Math.min(width * 0.15, 72);
  return (
    <View style={{ height: heroHeight }} className="bg-ink overflow-hidden">
      <Image
        source={HERO}
        accessibilityLabel="A woman in a white embroidered suit and dupatta sits on a wooden bench in a hallway, her chin resting on her hand."
        resizeMode="cover"
        style={{ position: 'absolute', width: '100%', height: '100%' }}
      />
      <Svg style={{ position: 'absolute', bottom: 0, left: 0 }} width={width} height={heroHeight * 0.55}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tokens.colors.ink} stopOpacity="0" />
            <Stop offset="1" stopColor={tokens.colors.ink} stopOpacity="0.82" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={heroHeight * 0.55} fill="url(#fade)" />
      </Svg>
      <View className="absolute bottom-7 right-4" accessibilityRole="header" accessibilityLabel="The Indian Wholesale Club">
        {WORDS.map((word, i) => (
          <View key={word} style={{ height: size * 0.92 }}>
            <Word word={word} index={i} size={size} scrollY={scrollY} heroHeight={heroHeight} />
          </View>
        ))}
        <Text className="font-body text-canvas mt-3.5 text-right text-[11px] uppercase tracking-[1.8px]">
          Clothing and spices from home
        </Text>
      </View>
    </View>
  );
}

/** The bar that fades in with the logo as the hero words fade out. */
export function HomeTopBar({ scrollY, topInset }: { scrollY: SharedValue<number>; topInset: number }): React.JSX.Element {
  const { height } = useWindowDimensions();
  const heroHeight = Math.round(height * 0.82);
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

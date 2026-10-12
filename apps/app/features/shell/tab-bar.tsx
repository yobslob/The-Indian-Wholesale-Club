import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import tokens from '@repo/tokens';

import type { Tabs } from 'expo-router';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, IconName> = {
  index: 'home-outline',
  explore: 'search-outline',
  bag: 'bag-outline',
  saved: 'heart-outline',
  profile: 'person-outline',
};

const SPRING = { damping: 18, stiffness: 220, mass: 0.8 };

/** The current tab shows the filled icon where Ionicons has one ("bag-outline" → "bag", D-116). */
function filled(name: IconName): IconName {
  const solid = name.replace(/-outline$/, '');
  return solid in Ionicons.glyphMap ? (solid as IconName) : name;
}

/** The count on a tab: pops when it goes up (D-116). */
function Badge({ value }: { value: string | number }): React.JSX.Element {
  const scale = useSharedValue(1);
  const last = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!reduce && Number(value) > Number(last.current))
      scale.value = withSequence(
        withTiming(0.4, { duration: 0 }),
        withSpring(1, { damping: 8, stiffness: 280 }),
      );
    last.current = value;
  }, [value, reduce, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      className="bg-brand rounded-pill absolute left-1/2 top-1 ml-1.5 h-[18px] min-w-[18px] items-center justify-center px-[5px]"
      style={style}
    >
      <Text className="font-ui-semibold text-on-brand text-[10px]">{String(value)}</Text>
    </Animated.View>
  );
}

/** One tab's icon: a small spring when it becomes the current one. */
function TabIcon({
  name,
  focused,
  color,
}: {
  name: IconName;
  focused: boolean;
  color: string;
}): React.JSX.Element {
  const scale = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (focused && !reduce)
      scale.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, SPRING));
  }, [focused, reduce, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Ionicons name={focused ? filled(name) : name} size={24} color={color} />
    </Animated.View>
  );
}

/**
 * The app's tab bar (D-095): cream, a line on top, Karla labels, a short brand-colour bar over the active tab and the
 * bag count as a brand pill (D-079's header icons, in the app's own place for them). Since D-116 the bar glides to
 * the tab that is chosen, the current tab's icon is filled and gives a small spring, and the count pops when it grows.
 */
export function TabBar({
  state,
  descriptors,
  navigation,
  icons = ICONS,
  badgeLabel = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'}`,
  above,
}: TabBarProps & {
  /** The admin mode's own tabs and icons (D-097). */
  icons?: Record<string, IconName>;
  /** What a badge counts, for screen readers: pieces in the bag, or what waits (admin). */
  badgeLabel?: (n: string | number) => string;
  /** Drawn just above the tabs (the customer tabs' free-delivery pill, D-111). */
  above?: React.ReactNode;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const tab = width / Math.max(state.routes.length, 1);
  const x = useSharedValue(0);
  useEffect(() => {
    const to = state.index * tab + tab / 2 - 10;
    x.value = reduce || x.value === 0 ? to : withSpring(to, SPRING);
  }, [state.index, tab, reduce, x]);
  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View>
      {above}
      <View
        className="bg-canvas border-line flex-row border-t"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
        accessibilityRole="tablist"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Animated.View
            className="bg-brand absolute left-0 top-0 h-0.5 w-5 rounded-sm"
            style={marker}
          />
        ) : null}
        {state.routes.map((route, i) => {
          const { options } = descriptors[route.key] ?? { options: {} };
          const focused = state.index === i;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const badge = options.tabBarBadge;
          const color = focused ? tokens.colors.ink : tokens.colors['ink-muted'];
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badgeLabel(badge)}` : label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented)
                  navigation.navigate(route.name, route.params);
              }}
              className="min-h-[52px] flex-1 items-center gap-1 pb-1.5 pt-2.5"
            >
              <TabIcon
                name={icons[route.name] ?? 'ellipse-outline'}
                focused={focused}
                color={color}
              />
              <Text
                className={`font-ui text-[11px] tracking-[0.2px] ${focused ? 'text-ink' : 'text-ink-muted'}`}
              >
                {label}
              </Text>
              {badge ? <Badge value={badge} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

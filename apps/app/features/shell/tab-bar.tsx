import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import tokens from '@repo/tokens';

import type { Tabs } from 'expo-router';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'home-outline',
  explore: 'search-outline',
  bag: 'bag-outline',
  saved: 'heart-outline',
  profile: 'person-outline',
};

/**
 * The app's tab bar (D-095): cream, a line on top, Karla labels, a short brand-colour bar over the active tab and the
 * bag count as a brand pill (D-079's header icons, in the app's own place for them).
 */
export function TabBar({
  state,
  descriptors,
  navigation,
  icons = ICONS,
  badgeLabel = (n) => `${n} ${n === 1 ? 'piece' : 'pieces'}`,
}: TabBarProps & {
  /** The admin mode's own tabs and icons (D-097). */
  icons?: Record<string, keyof typeof Ionicons.glyphMap>;
  /** What a badge counts, for screen readers: pieces in the bag, or what waits (admin). */
  badgeLabel?: (n: string | number) => string;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="bg-canvas border-line flex-row border-t"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      accessibilityRole="tablist"
    >
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
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            className="min-h-[52px] flex-1 items-center gap-1 pb-1.5 pt-2.5"
          >
            {focused ? <View className="bg-brand absolute top-0 h-0.5 w-5 rounded-sm" /> : null}
            <Ionicons name={icons[route.name] ?? 'ellipse-outline'} size={24} color={color} />
            <Text className={`font-ui text-[11px] tracking-[0.2px] ${focused ? 'text-ink' : 'text-ink-muted'}`}>{label}</Text>
            {badge ? (
              <View className="bg-brand absolute left-1/2 top-1 ml-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-pill px-[5px]">
                <Text className="font-ui-semibold text-on-brand text-[10px]">{String(badge)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

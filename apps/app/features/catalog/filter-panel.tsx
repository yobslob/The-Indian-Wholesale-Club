import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import tokens from '@repo/tokens';

export interface FilterChoice {
  slug: string | undefined;
  name: string;
  count?: number;
}

function List({ title, items, current, onPick }: { title: string; items: FilterChoice[]; current: string | undefined; onPick: (slug: string | undefined) => void }): React.JSX.Element {
  return (
    <View>
      <Text className="font-ui-semibold text-ink-muted mb-1 mt-[18px] text-[11px] uppercase tracking-[1.8px]">{title}</Text>
      {items.map((it) => {
        const on = it.slug === current;
        return (
          <Pressable
            key={it.slug ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(it.slug)}
            className="border-line min-h-12 flex-row items-center gap-2.5 border-b"
          >
            <Text className="text-brand w-5 text-base">{on ? '✓' : ''}</Text>
            <Text className="font-ui text-ink flex-1 text-[15px]">{it.name}</Text>
            {it.count !== undefined ? <Text className="font-body text-ink-muted text-[15px]">{it.count}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The Filter panel (D-084, D-095): from the right with the menu's motion, State and Category as lists with counts, the
 * current ones ticked, Clear; choosing a row applies it and closes the panel.
 */
export function FilterPanel({
  open,
  onClose,
  states,
  categories,
  state,
  category,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  states: FilterChoice[];
  categories: FilterChoice[];
  state: string | undefined;
  category: string | undefined;
  onPick: (next: { region?: string; category?: string }) => void;
}): React.JSX.Element {
  const { width } = useWindowDimensions();
  const panel = Math.min(width * 0.86, 380);
  const x = useRef(new Animated.Value(panel)).current;
  useEffect(() => {
    if (open) Animated.timing(x, { toValue: 0, duration: 420, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: true }).start();
    else x.setValue(panel);
  }, [open, panel, x]);
  const pick = (next: { region?: string; category?: string }): void => {
    onPick(next);
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close filter" onPress={onClose} className="absolute inset-0 bg-[rgba(20,17,15,0.4)]" />
      {/* NativeWind styles plain views only: the animated wrapper takes styles, the panel inside takes the classes. */}
      <Animated.View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: panel, transform: [{ translateX: x }] }}>
        <SafeAreaView edges={['top', 'bottom']} className="bg-canvas border-line flex-1 border-l">
          <View className="border-line flex-row items-center gap-2 border-b px-5 py-2">
            <Text accessibilityRole="header" className="font-heading flex-1 text-[22px] text-[#1D1A17]">
              Filter
            </Text>
            {state || category ? (
              <Pressable accessibilityRole="button" onPress={() => pick({})} className="min-h-11 justify-center px-1">
                <Text className="font-ui text-ink-muted text-sm underline">Clear</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Close filter" onPress={onClose} className="h-11 w-11 items-center justify-center">
              <Ionicons name="close" size={22} color={tokens.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerClassName="px-5 pb-8">
            <List title="State" items={states} current={state} onPick={(slug) => pick({ region: slug })} />
            {categories.length > 1 ? (
              <List title="Category" items={categories} current={category} onPick={(slug) => pick({ region: state, category: slug })} />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

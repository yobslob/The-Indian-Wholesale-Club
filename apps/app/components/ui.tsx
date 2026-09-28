import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import tokens from '@repo/tokens';

import type { TextInputProps } from 'react-native';

/** Plain building blocks on the design tokens (design.md); real design comes with the mockups. */

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}): React.JSX.Element {
  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-4 p-4 pb-12"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-ink text-2xl font-semibold">{children}</Text>;
}

export function Heading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-ink text-lg font-medium">{children}</Text>;
}

export function Body({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}): React.JSX.Element {
  return (
    <Text className={muted ? 'text-ink-muted text-sm' : 'text-ink text-base'}>{children}</Text>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="text-danger text-sm">{children}</Text>;
}

export function Loading(): React.JSX.Element {
  return (
    <View className="items-center p-8">
      <ActivityIndicator />
    </View>
  );
}

/** 44 pt touch targets everywhere (design.md §Accessibility). */
export function Button({
  label,
  onPress,
  disabled,
  kind = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'link';
}): React.JSX.Element {
  if (kind === 'link') {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        className="min-h-11 justify-center"
      >
        <Text className="text-ink text-sm underline">{label}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`bg-brand min-h-11 items-center justify-center rounded-sm px-4 ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-canvas text-sm font-medium">{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps): React.JSX.Element {
  return (
    <View className="gap-1">
      <Text className="text-ink text-sm">{label}</Text>
      <TextInput
        className="border-line bg-canvas text-ink min-h-11 rounded-sm border px-3"
        placeholderTextColor={tokens.colors['ink-muted']}
        {...input}
      />
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="border-line gap-1 rounded-md border p-3">{children}</View>;
}

export function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-ink-muted flex-1 text-sm">{label}</Text>
      <Text className="text-ink text-sm">{value}</Text>
    </View>
  );
}

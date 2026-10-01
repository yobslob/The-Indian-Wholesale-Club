import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

/**
 * Building blocks in the approved design (design.md §Direction, D-050 – D-055): Helvetica Neue titles, Poppins
 * text, Montserrat for controls, pill buttons, rounded paper inputs and surface cards, on the shared tokens.
 */

export function Screen({
  children,
  refreshing,
  onRefresh,
  back = true,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** A Back control on pushed screens; off where a stack header already has one (admin screens). */
  back?: boolean;
}): React.JSX.Element {
  const router = useRouter();
  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 px-4 pb-16 pt-4"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
        {/* The stack has no header bar (app/_layout.tsx), so a pushed screen shows its own way back. */}
        {back && router.canGoBack() ? (
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="-mb-2 -ml-1 min-h-11 flex-row items-center gap-1 self-start pr-3"
          >
            <Ionicons name="chevron-back" size={20} color={tokens.colors.ink} />
            <Text className="font-ui text-ink text-sm">Back</Text>
          </Pressable>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text accessibilityRole="header" className="font-hero text-ink text-[34px] leading-[38px] tracking-[-1px]">
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text accessibilityRole="header" className="font-hero text-ink text-[24px] leading-[28px] tracking-[-0.5px]">
      {children}
    </Text>
  );
}

/** Small uppercase label above a group (e.g. "OPEN NOW"). */
export function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="font-ui-semibold text-ink-muted text-[11px] uppercase tracking-[1.8px]">{children}</Text>;
}

export function Body({ children, muted }: { children: React.ReactNode; muted?: boolean }): React.JSX.Element {
  return (
    <Text className={muted ? 'font-body text-ink-muted text-sm leading-5' : 'font-body text-ink text-[15px] leading-6'}>
      {children}
    </Text>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Text className="font-body text-danger text-sm">{children}</Text>;
}

export function Loading(): React.JSX.Element {
  return (
    <View className="items-center p-8">
      <ActivityIndicator color={tokens.colors.ink} />
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
  kind?: 'primary' | 'secondary' | 'link';
}): React.JSX.Element {
  if (kind === 'link') {
    return (
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" className="min-h-11 justify-center">
        <Text className="font-ui text-ink text-sm underline">{label}</Text>
      </Pressable>
    );
  }
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`min-h-[52px] items-center justify-center rounded-pill px-6 ${
        primary ? 'bg-brand' : 'border-line bg-paper border'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className={`font-ui text-[15px] ${primary ? 'text-on-brand' : 'text-ink'}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps): React.JSX.Element {
  return (
    <View className="gap-1.5">
      <Text className="font-ui text-ink text-[13px]">{label}</Text>
      <TextInput
        className="border-line bg-paper text-ink font-body min-h-12 rounded-md border px-3.5 text-[15px]"
        placeholderTextColor={tokens.colors['ink-muted']}
        {...input}
      />
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View className="bg-surface gap-1.5 rounded-lg p-4">{children}</View>;
}

export function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="font-body text-ink-muted flex-1 text-sm">{label}</Text>
      <Text className="font-body text-ink text-sm">{value}</Text>
    </View>
  );
}

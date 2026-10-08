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
 * Building blocks in the approved design (design.md, D-079, D-080, D-095): Syne titles and headings, Karla text and
 * controls, Cinzel for names; pill buttons, rounded paper inputs and surface cards, on the shared tokens.
 */

/**
 * A screen (D-095): a tab root gets a large title in Syne; a pushed screen gets a back bar that stays at the top, with
 * its title when it has one (the stack has no header bar, app/_layout.tsx).
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  back = true,
  title,
  scrollRef,
  top,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** A back bar on pushed screens; off on tab roots and where a stack header already has one (admin screens). */
  back?: boolean;
  /** Tab roots: the large title. Pushed screens: the back bar's title. */
  title?: string;
  /** For screens that scroll to a section (the region page's jump pills). */
  scrollRef?: React.RefObject<ScrollView>;
  /** Full-bleed content above the padded column (the region photo), under the back bar. */
  top?: React.ReactNode;
}): React.JSX.Element {
  const showBar = back;
  return (
    <SafeAreaView className="bg-canvas flex-1" edges={['top']}>
      {showBar ? <BackBar title={title} /> : null}
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="pb-16"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} /> : undefined
        }
      >
        {top}
        <View className="gap-5 px-4 pt-4">
          {!showBar && title ? <Title>{title}</Title> : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** The back bar of a pushed screen: Back on the left, the screen's title in the middle (D-095). */
export function BackBar({ title, onClose }: { title?: string; onClose?: () => void }): React.JSX.Element {
  const router = useRouter();
  return (
    <View className="bg-canvas border-line min-h-12 flex-row items-center border-b px-2">
      <Pressable
        // Opened from a link with nothing behind it (a shared link, a notification): Back goes Home.
        onPress={onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        accessibilityRole="button"
        accessibilityLabel="Back"
        className="min-h-11 w-11 items-center justify-center"
      >
        <Ionicons name="chevron-back" size={22} color={tokens.colors.ink} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} className="font-heading flex-1 text-center text-[17px] text-[#1D1A17]">
        {title ?? ''}
      </Text>
      <View className="w-11" />
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text accessibilityRole="header" className="font-heading text-[32px] leading-[36px] tracking-[-0.6px] text-[#1D1A17]">
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Text accessibilityRole="header" className="font-heading text-ink text-[24px] leading-[28px] tracking-[-0.5px]">
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

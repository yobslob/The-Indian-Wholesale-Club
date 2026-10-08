import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import tokens from '@repo/tokens';

import { Button } from '@/components/ui';
import { FONTS } from '@/lib/fonts';
import { SessionProvider } from '@/lib/session';
import { StripeProvider } from '@/lib/stripe';

import '../global.css';

void SplashScreen.preventAutoHideAsync();

/**
 * One app for everyone (admin.md). Customers get the tabs in (customer); admin
 * mode (/admin) opens only after the server confirms the account is an admin.
 * The splash screen stays until the fonts are ready (no flash of system fonts).
 */
export default function RootLayout(): React.JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  const ready = fontsLoaded || fontError !== null;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.canvas } }} />
      </SessionProvider>
    </StripeProvider>
  );
}

/**
 * The error state (D-093, D-095): any screen that fails shows the website's words and Try again; no internals. Expo
 * Router uses this export as the boundary for every screen under this layout.
 */
export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }): React.JSX.Element {
  return (
    <SafeAreaView className="bg-canvas flex-1">
      <View className="gap-3 px-4 pt-[120px]">
        <Text accessibilityRole="header" className="font-heading text-[34px] leading-[37px] text-[#1D1A17]">
          Something went wrong
        </Text>
        <Text className="font-body text-ink text-[17px] leading-[26px]">
          That’s on us, not you. Try again, and if it keeps happening, give it a few minutes.
        </Text>
        <Button label="Try again" onPress={() => void retry()} />
      </View>
    </SafeAreaView>
  );
}

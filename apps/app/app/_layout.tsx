import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import tokens from '@repo/tokens';

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

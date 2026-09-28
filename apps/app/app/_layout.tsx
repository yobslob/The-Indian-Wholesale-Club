import { StripeProvider } from '@stripe/stripe-react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { SessionProvider } from '@/lib/session';

import '../global.css';

/**
 * One app for everyone (admin.md). Customers get the tabs in (customer); admin
 * mode (/admin) opens only after the server confirms the account is an admin.
 */
export default function RootLayout(): React.JSX.Element {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}>
      <SessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFFFF' } }}
        />
      </SessionProvider>
    </StripeProvider>
  );
}

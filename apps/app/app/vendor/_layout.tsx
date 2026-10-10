import { Redirect, Stack } from 'expo-router';

import tokens from '@repo/tokens';

import { Loading } from '@/components/ui';
import { VendorProvider } from '@/features/vendor/context';
import { useSession } from '@/lib/session';

/**
 * Vendor mode (D-102, vendor.md). Mounted only after the server confirms a vendor account (is_vendor()); anyone else
 * goes to the store. The screens ship in the binary, so every read and write is also limited by the database to the
 * vendor's own (vendor_* functions, INV-10).
 */
export default function VendorLayout(): React.JSX.Element {
  const { ready, isVendor } = useSession();
  if (!ready) return <Loading />;
  if (!isVendor) return <Redirect href="/" />;
  return (
    <VendorProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.canvas } }} />
    </VendorProvider>
  );
}

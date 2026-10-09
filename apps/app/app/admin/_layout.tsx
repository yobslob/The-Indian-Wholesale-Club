import { Redirect, Stack } from 'expo-router';

import tokens from '@repo/tokens';

import { Loading } from '@/components/ui';
import { useSession } from '@/lib/session';

/**
 * Admin mode (admin.md §App). Mounted only after the server confirms the
 * account is an admin (is_admin(): role + admin email list, D-006); anyone else
 * is sent to the store. The screens ship in the binary, so every read and
 * write is also refused by the database for non-admins (RLS, INV-7).
 */
export default function AdminLayout(): React.JSX.Element {
  const { ready, isAdmin, viewingStore } = useSession();
  if (!ready) return <Loading />;
  if (!isAdmin || viewingStore) return <Redirect href="/" />;

  // Pushed screens draw their own back bar (Screen), as the customer screens do (D-095, D-097).
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.canvas } }} />;
}

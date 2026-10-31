import { after } from 'next/server';

import { signOutAction } from '@/features/account/actions';
import { waitingCounts } from '@/features/admin/counts';
import { AdminFrame } from '@/features/admin/frame';
import { requireAdminPage } from '@/features/admin/guard';
import { sweepPhotoCopies } from '@/features/admin/photo-sweep';
import { tokenClient } from '@/lib/supabase/server';

/**
 * Every admin page passes this server check first (admin.md §Access model), then sits in the frame (D-096). The
 * sidebar's counts are not waited for: the frame and the page show at once and the numbers stream in, and a failed
 * count only leaves its number off (it never fails the page). After the page is sent, photos stored without their
 * fixed copies get them, a few at a time (D-140, features/admin/photo-sweep.ts).
 */
export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const { client, user, desk } = await requireAdminPage();
  const counts = waitingCounts(client).catch(() => null);
  const token = (await client.auth.getSession()).data.session?.access_token;
  if (token) after(() => sweepPhotoCopies(tokenClient(token)));
  return (
    <AdminFrame counts={counts} email={user.email} desk={desk} signOut={signOutAction}>
      {children}
    </AdminFrame>
  );
}

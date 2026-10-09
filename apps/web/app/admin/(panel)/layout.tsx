import { getWaitingCounts } from '@repo/db/admin';

import { signOutAction } from '@/features/account/actions';
import { AdminFrame } from '@/features/admin/frame';
import { requireAdminPage } from '@/features/admin/guard';

/** Every admin page passes this server check first (admin.md §Access model), then sits in the frame (D-096). */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { client, user, desk } = await requireAdminPage();
  const counts = await getWaitingCounts(client);
  return (
    <AdminFrame counts={counts} email={user.email} desk={desk} signOut={signOutAction}>
      {children}
    </AdminFrame>
  );
}

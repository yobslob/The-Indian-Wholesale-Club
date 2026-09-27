import { redirect } from 'next/navigation';
import React from 'react';

import { AdminShell } from '@/components/admin';
import { getAdminIdentity, requireAdminRedirect } from '@/lib/auth/admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const identity = await getAdminIdentity();
  const redirectTo = await requireAdminRedirect('/login?redirect=/admin');
  if (redirectTo) redirect(redirectTo);

  return <AdminShell userEmail={identity?.email ?? 'admin'}>{children}</AdminShell>;
}

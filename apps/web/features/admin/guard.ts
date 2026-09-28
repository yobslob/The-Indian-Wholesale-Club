import 'server-only';

import { notFound, redirect } from 'next/navigation';

import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { IwcClient } from '@repo/db';

/**
 * Admin access (D-006, INV-7, admin.md §Access model): signed in AND email in
 * ADMIN_EMAILS AND profiles.role = 'admin'. The database checks the same rule
 * again (is_admin(): role + admin_emails), so a bypass here still reads nothing.
 */
export type AdminAccess =
  | { state: 'anonymous' }
  | { state: 'denied' }
  | { state: 'admin'; client: IwcClient; user: { id: string; email: string } };

function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function adminAccess(): Promise<AdminAccess> {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) return { state: 'anonymous' };
  if (!user.email || !allowlist().has(user.email)) return { state: 'denied' };
  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (error || data?.role !== 'admin') return { state: 'denied' };
  return { state: 'admin', client, user: { id: user.id, email: user.email } };
}

/** Admin pages: signed out → the admin sign-in page; anyone else → a plain 404. */
export async function requireAdminPage(): Promise<{
  client: IwcClient;
  user: { id: string; email: string };
}> {
  const access = await adminAccess();
  if (access.state === 'anonymous') redirect('/admin/login');
  if (access.state === 'denied') notFound();
  return access;
}

/** Server actions: anyone who is not an admin gets a 404, never a hint. */
export async function requireAdminAction(): Promise<{
  client: IwcClient;
  user: { id: string; email: string };
}> {
  const access = await adminAccess();
  if (access.state !== 'admin') notFound();
  return access;
}

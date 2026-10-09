import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { currentUser, sessionClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';

import type { Enum, IwcClient } from '@repo/db';

/**
 * Admin access (D-006, INV-7, admin.md §Access model): signed in AND email in
 * ADMIN_EMAILS AND profiles.role = 'admin'. The database checks the same rule
 * again (is_admin(): role + admin_emails), so a bypass here still reads nothing.
 */
export type AdminAccess =
  | { state: 'anonymous' }
  | { state: 'denied' }
  | { state: 'admin'; client: IwcClient; user: { id: string; email: string }; desk: Enum<'ops_desk'> | null };

function allowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Once per request: the layout, the page and its parts all ask, and share one answer (React cache). */
export const adminAccess = cache(async (): Promise<AdminAccess> => {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) return { state: 'anonymous' };
  if (!user.email || !allowlist().has(user.email)) return { state: 'denied' };
  const { data, error } = await client
    .from('profiles')
    .select('role, desk')
    .eq('id', user.id)
    .maybeSingle();
  if (error || data?.role !== 'admin') return { state: 'denied' };
  // D-007: the desk orders Today and sets the zone times are shown in (D-096).
  return { state: 'admin', client, user: { id: user.id, email: user.email }, desk: data.desk };
});

/** Admin pages: signed out → the admin sign-in page; anyone else → a plain 404. */
export async function requireAdminPage(): Promise<Extract<AdminAccess, { state: 'admin' }>> {
  const access = await adminAccess();
  if (access.state === 'anonymous') redirect('/admin/login');
  if (access.state === 'denied') notFound();
  return access;
}

/** Server actions: anyone who is not an admin gets a 404, never a hint. */
export async function requireAdminAction(): Promise<Extract<AdminAccess, { state: 'admin' }>> {
  const access = await adminAccess();
  if (access.state !== 'admin') notFound();
  return access;
}

/**
 * The app's admin calling a website API (B-17): `Authorization: Bearer <access token>`, verified with Supabase Auth,
 * then the same rule as the pages (email in ADMIN_EMAILS and profiles.role = 'admin'). False for anyone else.
 */
export async function isAdminBearer(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return false;
  const service = serviceClient();
  const { data, error } = await service.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !data.user || !email || !allowlist().has(email)) return false;
  const { data: profile } = await service.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return profile?.role === 'admin';
}

import 'server-only';

import { redirect } from 'next/navigation';

import { currentUser, sessionClient } from '@/lib/supabase/server';

import type { IwcClient } from '@repo/db';

/** Account pages: the signed-in customer and their client, or a redirect to /login. */
export async function requireCustomer(
  path: string,
): Promise<{ client: IwcClient; user: { id: string; email: string | null } }> {
  const client = await sessionClient();
  const user = await currentUser(client);
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);
  return { client, user };
}

/**
 * The profile's sections (D-089): the signed-in customer, or null. Signed out, the profile layout shows the sign-in
 * card on the page itself, so the sections render nothing instead of sending the visitor to /login.
 */
export async function customerOrNull(): Promise<{ client: IwcClient; user: { id: string; email: string | null } } | null> {
  const client = await sessionClient();
  const user = await currentUser(client);
  return user ? { client, user } : null;
}

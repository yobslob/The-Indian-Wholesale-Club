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

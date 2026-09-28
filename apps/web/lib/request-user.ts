import 'server-only';

import { currentUser, sessionClient } from '@/lib/supabase/server';
import { serviceClient } from '@/lib/supabase/service';

/**
 * Who is calling an API route: the website sends its session cookies, the app
 * sends `Authorization: Bearer <access token>`. The token is verified with
 * Supabase Auth; an invalid one counts as signed out (never an error that
 * reveals why). Used only to link an order to its account.
 */
export async function requestUser(
  request: Request,
): Promise<{ id: string; email: string | null } | null> {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) {
    const { data, error } = await serviceClient().auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email?.toLowerCase() ?? null };
  }
  return currentUser(await sessionClient());
}

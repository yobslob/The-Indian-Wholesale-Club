import 'server-only';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

import type { Database, IwcClient } from '@repo/db';

/**
 * The signed-in user's client (cookies). Makes a page dynamic, so use it only
 * on account, checkout, order and admin pages (engineering.md PR-1).
 */
export async function sessionClient(): Promise<IwcClient> {
  const cookieStore = await cookies();
  const client = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session on the paths that need it.
        }
      },
    },
  });
  // @supabase/ssr types the client with an older generic signature; the runtime object is the same.
  return client as unknown as IwcClient;
}

/** The signed-in user's id and email, verified (getClaims checks the JWT). Null when signed out. */
export async function currentUser(
  client: IwcClient,
): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await client.auth.getClaims();
  if (error || !data) return null;
  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
  };
}

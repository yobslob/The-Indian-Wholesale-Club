import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Client } from './types';
import type { Database } from '@repo/shared/types';


export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if middleware refreshes user sessions.
          }
        },
      },
    },
  );

  // See types.ts: normalize @supabase/ssr's legacy 3-generic signature once
  // at the boundary (M13).
  return client as unknown as Client;
}

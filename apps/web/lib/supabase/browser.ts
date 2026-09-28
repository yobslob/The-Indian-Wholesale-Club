import { createBrowserClient } from '@supabase/ssr';

import type { Database, IwcClient } from '@repo/db';

let client: IwcClient | null = null;

/** Browser client: sign-in forms and live availability (Realtime). One per tab. */
export function browserClient(): IwcClient {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  ) as unknown as IwcClient;
  return client;
}

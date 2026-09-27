import { createBrowserClient } from '@supabase/ssr';

import type { Client } from './types';
import type { Database } from '@repo/shared/types';


export function createClient() {
  // See types.ts: normalize @supabase/ssr's legacy 3-generic signature once
  // at the boundary (M13).
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as Client;
}

import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from '@/lib/env';

import type { Database, IwcClient } from '@repo/db';

let client: IwcClient | null = null;

/**
 * Cookie-less anon client for storefront reads (engineering.md PR-1). It never
 * touches cookies(), so pages that use it stay static and cacheable. It can
 * only read store_* objects (grants + RLS), exactly like a signed-out visitor.
 */
export function storeClient(): IwcClient {
  client ??= createClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

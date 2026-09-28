import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { supabaseUrl } from '@/lib/env';

import type { Database, IwcClient } from '@repo/db';

let client: IwcClient | null = null;

/**
 * Service-role client: bypasses RLS. Server code only (order creation,
 * webhooks, guest lookup, email outbox). Never import it from a client component.
 */
export function serviceClient(): IwcClient {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key)
      throw new Error(
        'Missing environment variable SUPABASE_SERVICE_ROLE_KEY (see apps/web/.env.example)',
      );
    client = createClient<Database>(supabaseUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

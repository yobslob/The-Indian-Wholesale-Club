import { createClient } from '@supabase/supabase-js';

import type { Database } from '@repo/shared/types';

/**
 * Supabase Admin Client — uses the SERVICE_ROLE_KEY to bypass RLS.
 *
 * ⚠️  NEVER import this in client components or expose to the browser.
 * Use ONLY in:
 *   - Server Actions
 *   - API Route handlers
 *   - Server Components (data mutations)
 *   - Webhook handlers
 *
 * Configuration is strict (M2/C7): missing URL or service-role key throws on
 * first property access instead of silently falling back to localhost or a
 * placeholder key. The Proxy keeps module evaluation safe for build steps
 * that import but never query.
 */

type AdminClient = ReturnType<typeof createClient<Database>>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireConfiguredClient(): AdminClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missing = [
      !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
      !supabaseServiceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(
      `supabaseAdmin is not configured: missing ${missing}. ` +
        'Set both variables (see .env.example); no localhost or placeholder fallback is allowed.',
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Created lazily so a missing env only fails when the client is actually used.
let client: AdminClient | null = null;

function getClient(): AdminClient {
  if (!client) {
    client = requireConfiguredClient();
  }
  return client;
}

export const supabaseAdmin = new Proxy({} as AdminClient, {
  get(_target, prop) {
    const instance = getClient() as unknown as Record<PropertyKey, unknown>;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  has(_target, prop) {
    const instance = getClient() as unknown as Record<PropertyKey, unknown>;
    return prop in instance;
  },
  ownKeys() {
    return Reflect.ownKeys(getClient() as unknown as object);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getClient() as unknown as object, prop);
    if (descriptor) {
      descriptor.configurable = true;
    }
    return descriptor;
  },
});

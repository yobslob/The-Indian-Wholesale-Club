import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import type { Database, IwcClient } from '@repo/db';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set (apps/app/.env). */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Development only: the address in use shows in the Metro terminal (a phone or emulator can't reach 127.0.0.1).
if (__DEV__) console.log(`[iwc] Supabase: ${url ?? '(EXPO_PUBLIC_SUPABASE_URL not set)'}`);

/** Sessions live in the device keychain / keystore. */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

/**
 * One client for the whole app, signed in or not. Customer screens read only
 * store_* data through @repo/db/store (D-017); admin screens use the same
 * client and the database's own admin check (RLS is_admin(), D-006).
 */
export const supabase: IwcClient = createClient<Database>(
  url ?? 'http://127.0.0.1:54321',
  anonKey ?? 'missing-anon-key',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

/** Public URL of a product photo in the public `product-media` bucket. */
export function mediaUrl(storagePath: string): string {
  const clean = storagePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${url ?? ''}/storage/v1/object/public/product-media/${clean}`;
}

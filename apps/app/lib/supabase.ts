import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

import { authStorage } from './auth-storage';
import { followMetroHost } from './local-host';

import type { Database, IwcClient } from '@repo/db';

// Development: a local address follows the computer Metro runs on, so a new Wi-Fi network needs no .env edit.
const url = __DEV__
  ? followMetroHost(process.env.EXPO_PUBLIC_SUPABASE_URL, Constants.expoConfig?.hostUri)
  : process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set (apps/app/.env). */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Development only: the address in use shows in the Metro terminal (a phone or emulator can't reach 127.0.0.1).
if (__DEV__) console.log(`[iwc] Supabase: ${url ?? '(EXPO_PUBLIC_SUPABASE_URL not set)'}`);

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
      storage: authStorage,
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

/** Public URL of a review photo (review-media; only approved reviews' photos are ever shown, D-056). */
export function reviewPhotoUrl(storagePath: string): string {
  const clean = storagePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${url ?? ''}/storage/v1/object/public/review-media/${clean}`;
}

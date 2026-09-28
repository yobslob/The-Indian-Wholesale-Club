import { supabase } from './supabase';

/**
 * The web server's API (checkout, order confirmation, guest order lookup).
 * On a phone use the computer's LAN address, e.g. http://192.168.1.10:3000 (apps/app/.env).
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Development only. The website's server (`pnpm --filter web dev`, port 3000), not Metro (8081).
if (__DEV__) console.log(`[iwc] Website API: ${API_BASE_URL}`);

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** POST JSON; sends the signed-in user's access token so the server can link the order to the account. */
export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (res.ok && json) return { ok: true, data: json };
    return {
      ok: false,
      status: res.status,
      error: json?.error ?? 'Something went wrong. Please try again.',
    };
  } catch {
    return { ok: false, status: 0, error: 'No connection. Please try again.' };
  }
}

import { supabase } from './supabase';

/**
 * Web API base URL for the mobile app.
 *
 * EXPO_PUBLIC_API_URL overrides the target (e.g. a LAN IP for a physical
 * device); development falls back to the local Next.js dev server.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export async function apiGet<T = Record<string, unknown>>(path: string): Promise<ApiResponse<T>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    const data = (await res.json().catch(() => null)) as T | null;
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : ((data as { error?: string } | null)?.error ?? 'Request failed'),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

export async function apiPost<T = Record<string, unknown>>(
  path: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => null)) as T | null;
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : ((data as { error?: string } | null)?.error ?? 'Request failed'),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

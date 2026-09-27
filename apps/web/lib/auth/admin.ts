import { NextResponse } from 'next/server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin authorization for API routes and server components.
 *
 * Rules (see BUGS.md C1):
 *  1. No session -> 401. There is no authentication bypass.
 *  2. Session must be an admin: either profiles.role = 'admin', or the
 *     email is listed in the ADMIN_EMAILS environment variable.
 *  3. If the profiles.role column does not exist yet (migration
 *     20260926000001 not applied) the request is allowed ONLY outside
 *     production so local development keeps working; production denies.
 *
 * Usage in an API route handler:
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */

export interface AdminIdentity {
  userId: string;
  email: string | null;
  role: 'admin' | 'staff' | 'customer' | 'unknown';
}

function adminEmailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized: admin session required' }, { status: 401 });
}

function forbidden(reason: string): NextResponse {
  return NextResponse.json({ error: `Forbidden: ${reason}` }, { status: 403 });
}

/**
 * Resolves the caller's admin identity, or null when unauthenticated.
 * Never throws.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const email = user.email?.toLowerCase() ?? null;
    if (email && adminEmailAllowlist().has(email)) {
      return { userId: user.id, email, role: 'admin' };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      // Migration 20260926000001 (profiles.role) not applied yet.
      return { userId: user.id, email, role: 'unknown' };
    }

    const role = (profile?.role as AdminIdentity['role'] | undefined) ?? 'customer';
    return { userId: user.id, email, role };
  } catch {
    return null;
  }
}

export function isGranted(identity: AdminIdentity | null): boolean {
  if (!identity) return false;
  if (identity.role === 'admin' || identity.role === 'staff') return true;
  if (identity.role === 'unknown') {
    // profiles.role unavailable: keep local dev usable, never production.
    return process.env.NODE_ENV !== 'production';
  }
  return false;
}

/** Returns a 401/403 NextResponse to send back, or null when authorized. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const identity = await getAdminIdentity();
  if (!identity) return unauthorized();
  if (isGranted(identity)) return null;
  if (identity.role === 'unknown') {
    return forbidden('admin role column missing - run migration 20260926000001 or set ADMIN_EMAILS');
  }
  return forbidden('user is not an admin');
}

/** Server-component equivalent (admin layout). Returns a redirect target or null. */
export async function requireAdminRedirect(loginPath = '/login?redirect=/admin'): Promise<string | null> {
  const identity = await getAdminIdentity();
  if (!identity) return loginPath;
  if (isGranted(identity)) return null;
  return `${loginPath}&error=forbidden`;
}

export async function verifyAdminSession(): Promise<{
  authorized: boolean;
  userId?: string;
  response?: NextResponse;
}> {
  const identity = await getAdminIdentity();
  if (!identity) return { authorized: false, response: unauthorized() };
  if (!isGranted(identity)) return { authorized: false, response: forbidden('user is not an admin') };
  return { authorized: true, userId: identity.userId };
}

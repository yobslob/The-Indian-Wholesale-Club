import { NextResponse } from 'next/server';

import { safeNextPath } from '@/lib/site';
import { sessionClient } from '@/lib/supabase/server';

/**
 * Where Supabase Auth's email links land (D-091): the reset link and, where confirmation is on, the sign-up link. The
 * one-time code in the address becomes the session cookie, then the visitor goes on to `next` (a same-site path only).
 * A used or expired link goes to sign-in with a note instead.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNextPath(url.searchParams.get('next'), '/account');
  if (code) {
    const client = await sessionClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?link=expired', url.origin));
}

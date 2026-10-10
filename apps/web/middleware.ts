import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Narrow middleware (engineering.md PR-4): runs only where a session matters
 * and just keeps the auth cookies fresh. Storefront pages never pass through it,
 * so they stay static and cacheable. Access control is NOT done here: every
 * admin page/action checks on the server (features/admin/guard.ts).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });

  // Refreshes an expired access token. With asymmetric signing keys this is a
  // local JWT check; with the legacy shared secret it falls back to one Auth call.
  await supabase.auth.getClaims();

  if (request.nextUrl.pathname.startsWith('/admin') || request.nextUrl.pathname.startsWith('/vendor')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/vendor/:path*', '/account/:path*', '/checkout/:path*', '/orders/:path*'],
};

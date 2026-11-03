import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { legacyHostsValue, siteUrl } from '@/lib/env';
import { bounceHtml } from '@/lib/legacy-bounce';
import { legacyMove, MOVED_COOKIE, parseHosts } from '@/lib/legacy-move';

/** The session paths (PR-4): the only ones whose auth cookies are refreshed here. */
const SESSION_PATH = /^\/(admin|vendor|account|checkout|orders)(\/|$)/;

let hostsRaw: string | undefined;
let hosts: ReadonlySet<string> = new Set();
/** LEGACY_HOSTS parsed once per instance (the middleware runs on every matched request). */
function legacyHosts(): ReadonlySet<string> {
  const raw = legacyHostsValue();
  if (raw !== hostsRaw) {
    hostsRaw = raw;
    hosts = parseHosts(raw);
  }
  return hosts;
}

/** E-1 (DOM-1): an old vercel.app page moves to the domain; everything else on that host is served (legacy-move.ts). */
function moveFromLegacyHost(request: NextRequest): NextResponse | null {
  const list = legacyHosts();
  if (list.size === 0) return null;
  const { headers, nextUrl } = request;
  const move = legacyMove(
    {
      host: headers.get('host'),
      method: request.method,
      pathname: nextUrl.pathname,
      search: nextUrl.search,
      navigate: headers.get('sec-fetch-mode') === 'navigate' && headers.get('sec-fetch-dest') === 'document',
      userAgent: headers.get('user-agent'),
      moved: request.cookies.has(MOVED_COOKIE),
    },
    list,
    siteUrl(),
  );
  if (move.kind === 'serve') return null;
  if (move.kind === 'redirect') return NextResponse.redirect(move.location, 308);
  const page = new NextResponse(bounceHtml(move.location), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
  page.cookies.set(MOVED_COOKIE, '1', { maxAge: 60 * 60 * 24 * 365, path: '/', secure: true, sameSite: 'lax' });
  return page;
}

/**
 * Narrow middleware (engineering.md PR-4): runs only where a session matters
 * and just keeps the auth cookies fresh. Storefront pages on the domain never pass through it,
 * so they stay static and cacheable. Access control is NOT done here: every
 * admin page/action checks on the server (features/admin/guard.ts).
 * E-1: on a `*.vercel.app` host it also runs for pages (the matcher below), to move the old address's pages.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const moved = moveFromLegacyHost(request);
  if (moved) return moved;
  if (!SESSION_PATH.test(request.nextUrl.pathname)) return NextResponse.next();

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
  matcher: [
    '/admin/:path*',
    '/vendor/:path*',
    '/account/:path*',
    '/checkout/:path*',
    '/orders/:path*',
    // E-1: every page on a vercel.app host (the old address, the new account's own name, previews), so the domain's
    // storefront pages still never invoke the middleware. Which vercel.app hosts move is LEGACY_HOSTS's list, not this.
    { source: '/((?!api/|media/|auth/|_next/).*)', has: [{ type: 'host', value: '.*\\.vercel\\.app' }] },
  ],
};

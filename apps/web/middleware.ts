import { NextResponse } from 'next/server';

import { rateLimit, ruleForPath } from '@/lib/rate-limit';
import { updateSession } from '@/lib/supabase/middleware';

import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Rate limiting for sensitive routes (H11)
  const matched = ruleForPath(request.nextUrl.pathname);
  if (matched) {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'local';
    const result = rateLimit(`${ip}:${matched.name}`, matched.rule);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Too many requests, please try again later' },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSeconds),
            'X-RateLimit-Limit': String(matched.rule.limit),
          },
        },
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

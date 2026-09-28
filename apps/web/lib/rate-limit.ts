import { NextResponse } from 'next/server';

/**
 * In-memory sliding-window rate limiter, applied inside the route handlers that
 * need it (checkout, orders, guest lookup) instead of in middleware (PR-4).
 * Known limit (engineering.md P8, backlog): per server instance, reset on cold
 * start. Replace with a shared store before launch.
 */
interface Rule {
  limit: number;
  windowMs: number;
}

export const RULES = {
  checkout: { limit: 20, windowMs: 60_000 },
  orderLookup: { limit: 10, windowMs: 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, Rule>;

const hits = new Map<string, number[]>();
const MAX_KEYS = 20_000;

export function rateLimit(
  key: string,
  rule: Rule,
  now = Date.now(),
): { ok: boolean; retryAfterSeconds: number } {
  const recent = (hits.get(key) ?? []).filter((t) => t > now - rule.windowMs);
  if (recent.length >= rule.limit) {
    hits.set(key, recent);
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)),
    };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) hits.clear();
  return { ok: true, retryAfterSeconds: 0 };
}

function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local'
  );
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function limitRequest(
  headers: Headers,
  name: keyof typeof RULES,
): NextResponse<{ error: string }> | null {
  const result = rateLimit(`${clientIp(headers)}:${name}`, RULES[name]);
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}

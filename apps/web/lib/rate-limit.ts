import { createHmac } from 'node:crypto';

import { NextResponse } from 'next/server';

import { errorMessage, logger } from '@/lib/logger';
import { serviceClient } from '@/lib/supabase/service';

import { rateLimit, RULES, type Rule } from './rate-limit-memory';

/**
 * Rate limits, applied inside the route handlers that need them (checkout, orders, guest lookup, the offer and the
 * customer's choices) instead of in middleware (PR-4). Shared across server instances through the database
 * (rate_limit_hit, B-3): one count per caller per minute, the caller's IP kept only as a keyed hash. If the database
 * can't be reached, the in-memory limiter (rate-limit-memory.ts) still applies, so a request is never let through unlimited.
 */

export { RULES };

function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local'
  );
}

/** The caller, as a keyed hash: the counter never stores an address. */
function callerKey(headers: Headers): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'iwc-rate-limit';
  return createHmac('sha256', secret).update(clientIp(headers)).digest('base64url').slice(0, 22);
}

async function sharedRateLimit(key: string, rule: Rule): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const { data, error } = await serviceClient().rpc('rate_limit_hit', {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: Math.round(rule.windowMs / 1000),
  });
  if (error) throw new Error(error.message);
  const result = data as { allowed?: boolean; retry_after?: number } | null;
  return { ok: result?.allowed !== false, retryAfterSeconds: result?.retry_after ?? 1 };
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export async function limitRequest(
  headers: Headers,
  name: keyof typeof RULES,
): Promise<NextResponse<{ error: string }> | null> {
  const key = `${callerKey(headers)}:${name}`;
  let result: { ok: boolean; retryAfterSeconds: number };
  try {
    result = await sharedRateLimit(key, RULES[name]);
  } catch (error) {
    logger.warn('rate_limit.shared_unavailable', { error: errorMessage(error) });
    result = rateLimit(key, RULES[name]);
  }
  if (result.ok) return null;
  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } },
  );
}

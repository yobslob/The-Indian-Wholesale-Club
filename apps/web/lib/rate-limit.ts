/**
 * In-memory sliding-window rate limiter (H11).
 *
 * Scope note: this is per-server-instance state (no Redis dependency).
 * It protects against naive brute force and enumeration; for horizontal
 * scaling, back this with a shared store.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

const hitsByKey = new Map<string, number[]>();
const MAX_KEYS = 20_000;

function cleanup(now: number, windowMs: number): void {
  for (const [key, timestamps] of hitsByKey) {
    const kept = timestamps.filter((t) => t > now - windowMs);
    if (kept.length === 0) hitsByKey.delete(key);
  }
  if (hitsByKey.size > MAX_KEYS) {
    hitsByKey.clear();
  }
}

export function rateLimit(
  key: string,
  rule: RateLimitRule,
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  const timestamps = hitsByKey.get(key) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);

  if (recent.length >= rule.limit) {
    const retryAfterMs = recent[0] + rule.windowMs - now;
    hitsByKey.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  hitsByKey.set(key, recent);

  if (hitsByKey.size > MAX_KEYS) cleanup(now, rule.windowMs);
  return { ok: true, retryAfterSeconds: 0 };
}

/** Route-class rules applied by middleware. */
export function ruleForPath(pathname: string): { name: string; rule: RateLimitRule } | null {
  if (/^\/api\/(orders\/create|checkout\/)/.test(pathname)) {
    return { name: 'checkout', rule: { limit: 20, windowMs: 60_000 } };
  }
  if (/^\/api\/(contact|newsletter)/.test(pathname)) {
    return { name: 'forms', rule: { limit: 10, windowMs: 60_000 } };
  }
  if (/^\/api\/admin\//.test(pathname)) {
    return { name: 'admin-api', rule: { limit: 120, windowMs: 60_000 } };
  }
  // H11: Rate-limit login/signup page loads to prevent automated credential attacks.
  // Note: Supabase auth calls go directly to Supabase from the browser, but limiting
  // page loads still mitigates automated form-fill bots.
  if (/^\/(login|signup)/.test(pathname)) {
    return { name: 'auth-pages', rule: { limit: 30, windowMs: 60_000 } };
  }
  // H11: Rate-limit search to prevent enumeration and abuse
  if (/^\/api\/search/.test(pathname)) {
    return { name: 'search-api', rule: { limit: 60, windowMs: 60_000 } };
  }
  // H11: Rate-limit health endpoint to prevent abuse
  if (/^\/api\/health/.test(pathname)) {
    return { name: 'health-api', rule: { limit: 30, windowMs: 60_000 } };
  }
  // H11: Rate-limit webhook endpoints to prevent replay/flood attacks
  if (/^\/api\/webhooks\//.test(pathname)) {
    return { name: 'webhooks', rule: { limit: 60, windowMs: 60_000 } };
  }
  if (/^\/(order-status\/|order-lookup)/.test(pathname)) {
    return { name: 'order-lookup', rule: { limit: 30, windowMs: 60_000 } };
  }
  return null;
}

/**
 * The in-memory sliding-window limiter: the fallback when the shared limiter (lib/rate-limit.ts, the database) can't
 * be reached. Pure, so it has unit tests (tests/rate-limit.test.ts).
 */
export interface Rule {
  limit: number;
  windowMs: number;
}

export const RULES = {
  checkout: { limit: 20, windowMs: 60_000 },
  orderLookup: { limit: 10, windowMs: 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
  /** Vendor sign-in codes (D-103): a few tries a minute is plenty for a person, too few to guess a 32-byte code. */
  vendorSignIn: { limit: 10, windowMs: 60_000 },
  /** "Join as a vendor?" requests (D-102). */
  vendorJoin: { limit: 5, windowMs: 60_000 },
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


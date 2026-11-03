/**
 * A time limit on every server call to Supabase (launch QA F-0, INC-1). Without one, a database short on disk IO made
 * requests wait 40–90 s and burn function time; now a read fails after 8 s and the caller answers "busy" or a cached
 * page keeps showing. Pure (no `server-only`), so the unit tests import it.
 */

/** As long as the database's own statement limit (D-146): a call that needs longer would fail there anyway. */
export const DB_TIMEOUT_MS = 8_000;
/** Photo uploads and downloads move whole files, so storage calls get longer. */
export const STORAGE_TIMEOUT_MS = 30_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** What a timed-out call throws: the name says "timeout", which postgrest-js copies into the error message. */
export class DbTimeoutError extends Error {
  constructor(ms: number) {
    super(`Database request timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** AbortSignal.any where the runtime has it (Node 20.3+), else the same by hand. */
function either(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  const controller = new AbortController();
  const stop = (s: AbortSignal): void => controller.abort(s.reason);
  if (a.aborted) stop(a);
  else if (b.aborted) stop(b);
  else {
    a.addEventListener('abort', () => stop(a), { once: true });
    b.addEventListener('abort', () => stop(b), { once: true });
  }
  return controller.signal;
}

/**
 * Wraps `base` so each call is aborted after its limit, together with any signal the caller passed (a call with
 * `.abortSignal()` still stops when that fires first). `base` defaults to the global fetch read at call time, so
 * Next.js's own fetch handling still applies.
 */
export function withTimeLimit(
  base: FetchLike = (input, init) => fetch(input, init),
  limits: { db: number; storage: number } = { db: DB_TIMEOUT_MS, storage: STORAGE_TIMEOUT_MS },
): FetchLike {
  return async (input, init) => {
    const ms = urlOf(input).includes('/storage/v1/') ? limits.storage : limits.db;
    const timer = AbortSignal.timeout(ms);
    const signal = init?.signal ? either(init.signal, timer) : timer;
    try {
      return await base(input, { ...init, signal });
    } catch (error) {
      if (timer.aborted && !init?.signal?.aborted) throw new DbTimeoutError(ms);
      throw error;
    }
  };
}

const BUSY_NAMES = new Set(['TimeoutError', 'AbortError']);
/** Postgres statement_timeout / PostgREST's "cannot reach the database" codes: the database is busy, not wrong. */
const BUSY_CODES = new Set(['57014', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

/**
 * True when an error means "the database did not answer in time" (our time limit, the caller's abort, the
 * database's statement limit or PostgREST unable to reach it): the caller should answer "busy, try again" (503).
 * Works on a raw error, a PostgrestError (`{ message, code }`) and `@repo/db`'s DbError.
 */
export function isDbBusy(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, message, code } = error as { name?: unknown; message?: unknown; code?: unknown };
  if (typeof name === 'string' && BUSY_NAMES.has(name)) return true;
  if (typeof code === 'string' && BUSY_CODES.has(code)) return true;
  return typeof message === 'string' && /^(TimeoutError|AbortError)\b/.test(message);
}

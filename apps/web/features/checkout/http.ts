import { z } from 'zod';

/**
 * The checkout's calls to its own API (/api/checkout, /api/orders), never trusting the answer's shape: a slow
 * database (503 + Retry-After), the rate limit (429), a gateway's HTML error page, a dropped connection or a request
 * that takes too long all come back as a message the page can show, never as a thrown error (launch QA A-2, A-3).
 * Pure apart from `fetch`, so the mapping has unit tests (tests/checkout-http.test.ts).
 */
export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      /** null when no answer came back (offline, timeout, aborted). */
      status: number | null;
      message: string;
      /** The server's own `{ error }` text, when there was one. */
      serverMessage: string | null;
      /** The server's `{ problem }`, unchecked (the caller checks what it reads). */
      problem?: unknown;
      retryAfterSeconds: number | null;
      timedOut: boolean;
    };

export const MESSAGES = {
  offline: 'Connection problem. Please check your connection and try again.',
  timeout: 'This is taking longer than it should. Please try again.',
  busy: 'Too many tries in a row. Please wait a minute and try again.',
  server: 'We are having trouble right now. Please try again in a minute.',
  unexpected: 'Something went wrong. Please try again.',
} as const;

const errorBodySchema = z.object({ error: z.string().min(1) });

function retryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Turns a finished HTTP answer into a result: a 2xx whose body has the success shape, or a message. */
export function interpretResponse<T>(
  status: number,
  text: string,
  retryAfterHeader: string | null,
  success: z.ZodType<T>,
): ApiResult<T> {
  const json = parseJson(text);
  if (status >= 200 && status < 300) {
    const parsed = success.safeParse(json);
    if (parsed.success) return { ok: true, status, data: parsed.data };
  }
  const error = errorBodySchema.safeParse(json);
  const serverMessage = error.success ? error.data.error : null;
  const fallback =
    status === 429 ? MESSAGES.busy : status >= 500 ? MESSAGES.server : MESSAGES.unexpected;
  return {
    ok: false,
    status,
    message: serverMessage ?? fallback,
    serverMessage,
    problem: typeof json === 'object' && json !== null && 'problem' in json ? json.problem : undefined,
    retryAfterSeconds: retryAfter(retryAfterHeader),
    timedOut: false,
  };
}

function isTimeout(error: unknown): boolean {
  // fetch rejects with the signal's reason, a DOMException (not an Error subclass in every browser).
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : null;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** POSTs JSON with a time limit and returns a result (never throws). */
export async function postJson<T>(
  url: string,
  body: unknown,
  success: z.ZodType<T>,
  { timeoutMs, fetchImpl = fetch }: { timeoutMs: number; fetchImpl?: typeof fetch },
): Promise<ApiResult<T>> {
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    return interpretResponse(res.status, text, res.headers.get('retry-after'), success);
  } catch (error) {
    const timedOut = isTimeout(error);
    return {
      ok: false,
      status: null,
      message: timedOut ? MESSAGES.timeout : MESSAGES.offline,
      serverMessage: null,
      retryAfterSeconds: null,
      timedOut,
    };
  }
}

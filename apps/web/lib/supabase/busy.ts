import { NextResponse } from 'next/server';

import { isDbBusy, withTimeLimit } from './timeout';

/**
 * F-0: what every server Supabase client is created with. Each call has the time limit, and postgrest-js's own
 * retries are off: a retried read could wait 8 s three more times (with its back-off and any `Retry-After`), which is
 * the hang the limit exists to stop. One attempt, at most 8 s.
 */
export const serverDbOptions = {
  global: { fetch: withTimeLimit() },
  db: { retry: false },
} as const;

export const BUSY_MESSAGE = "We're busy right now. Please try again in a minute.";

/** 503 with a message the customer can read and when to try again. Never says why (D-003). */
export function busyResponse(): NextResponse<{ error: string }> {
  return NextResponse.json({ error: BUSY_MESSAGE }, { status: 503, headers: { 'Retry-After': '30' } });
}

/** In an API route's catch: the busy answer when the database timed out, else null (the route answers as before). */
export function busyIfDbTimeout(error: unknown): NextResponse<{ error: string }> | null {
  return isDbBusy(error) ? busyResponse() : null;
}

export { isDbBusy };

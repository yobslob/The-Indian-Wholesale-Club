import { z } from 'zod';

import { postJson, type ApiResult } from './http';

import type { FinalizeResponse } from './types';

/**
 * Asking the server to create the order for a paid PaymentIntent (POST /api/orders, flows.md §3). The Stripe webhook
 * does the same on its own, so a paid customer whose confirmation fails here is still kept: the thank-you page keeps
 * asking with back-off (launch QA A-2, A-4). Pure apart from `fetch`; tests/checkout-order-confirm.test.ts.
 */
export type OrderOutcome =
  | { kind: 'confirmed'; orderNumber: string }
  /** No order: an item sold out or the order-by time passed, and the payment was refunded (409). Final. */
  | { kind: 'refused'; message: string }
  /** The server does not know this payment (400). Final: asking again will not help. */
  | { kind: 'unconfirmed' }
  /** Still processing (202), busy (429, 503), a server error, offline or too slow: ask again later. */
  | { kind: 'waiting'; retryAfterSeconds: number | null };

const finalizeSchema: z.ZodType<FinalizeResponse> = z.object({ orderNumber: z.string().min(1) });

/** How long one confirmation request may take before it counts as "no answer yet". */
export const CONFIRM_TIMEOUT_MS = 15_000;

/** The pauses between tries on the thank-you page: 2, 4, 8, 16 and 30 s, about a minute in all. */
export const POLL_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000] as const;

export function classifyOrderResult(result: ApiResult<FinalizeResponse>): OrderOutcome {
  if (result.ok) return { kind: 'confirmed', orderNumber: result.data.orderNumber };
  if (result.status === 409 && result.serverMessage)
    return { kind: 'refused', message: result.serverMessage };
  if (result.status === 400) return { kind: 'unconfirmed' };
  return { kind: 'waiting', retryAfterSeconds: result.retryAfterSeconds };
}

export async function confirmOrder(
  paymentIntentId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrderOutcome> {
  const result = await postJson('/api/orders', { paymentIntentId }, finalizeSchema, {
    timeoutMs: CONFIRM_TIMEOUT_MS,
    fetchImpl,
  });
  return classifyOrderResult(result);
}

/** The pause before the next try: the planned one, longer if the server asked for it (at most 30 s). */
export function nextDelayMs(plannedMs: number, retryAfterSeconds: number | null): number {
  if (retryAfterSeconds === null) return plannedMs;
  return Math.max(plannedMs, Math.min(retryAfterSeconds * 1000, 30_000));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export type PollOutcome = Exclude<OrderOutcome, { kind: 'waiting' }> | { kind: 'gave_up' };

/**
 * Tries now, then after each pause in `delays`, until the order exists or the answer is final. Returns null when
 * `signal` aborts (the page was left).
 */
export async function pollOrder(
  paymentIntentId: string,
  {
    signal,
    confirm = confirmOrder,
    wait = sleep,
    delays = POLL_DELAYS_MS,
  }: {
    signal: AbortSignal;
    confirm?: (paymentIntentId: string) => Promise<OrderOutcome>;
    wait?: (ms: number, signal: AbortSignal) => Promise<void>;
    delays?: readonly number[];
  },
): Promise<PollOutcome | null> {
  for (let attempt = 0; ; attempt += 1) {
    const outcome = await confirm(paymentIntentId);
    if (signal.aborted) return null;
    if (outcome.kind !== 'waiting') return outcome;
    const planned = delays[attempt];
    if (planned === undefined) return { kind: 'gave_up' };
    await wait(nextDelayMs(planned, outcome.retryAfterSeconds), signal);
    if (signal.aborted) return null;
  }
}

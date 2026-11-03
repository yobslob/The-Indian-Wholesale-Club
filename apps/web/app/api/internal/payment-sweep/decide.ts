/**
 * The payment sweep's decisions (launch QA F-2), kept pure so the unit tests check them without Stripe or a database.
 */

/** What to do with one unreconciled checkout once Stripe said where its payment stands. */
export type SweepStep = { kind: 'finalize' } | { kind: 'wait' } | { kind: 'stop'; note: string };

/**
 * succeeded: paid, so the order must exist (create it), unless someone already refunded it in Stripe (a payment
 * refunded by hand keeps the status succeeded; an order then would be one nobody paid for). canceled: it never will be
 * paid (stop looking). Anything else (not paid yet, still processing, needs the customer's action): ask again in an
 * hour, until it is 2 days old.
 */
export function stepForPayment(status: string, refundedCents = 0): SweepStep {
  if (status === 'succeeded' && refundedCents > 0) return { kind: 'stop', note: 'refunded in Stripe' };
  if (status === 'succeeded') return { kind: 'finalize' };
  if (status === 'canceled') return { kind: 'stop', note: 'payment cancelled' };
  return { kind: 'wait' };
}

/** The part of finalizeOrder's result the sweep reads (features/checkout/finalize.ts). */
export type FinalizeOutcome =
  | { ok: true; orderNumber: string }
  | { ok: false; reason: string; detail?: string };

export type AfterFinalize = { kind: 'done'; orderNumber: string } | { kind: 'wait' } | { kind: 'stop'; note: string };

/**
 * After finalizing a paid checkout: done (the order exists), wait (Stripe's answer changed in between), or stop
 * looking; finalize has then recorded why in failed_reconciliations (a mismatch, or the order refused and refunded).
 */
export function stepAfterFinalize(result: FinalizeOutcome): AfterFinalize {
  if (result.ok) return { kind: 'done', orderNumber: result.orderNumber };
  if (result.reason === 'payment_not_complete') return { kind: 'wait' };
  return { kind: 'stop', note: `not finalized: ${result.reason}${result.detail ? ` (${result.detail})` : ''}` };
}

/** Stripe's answer for a PaymentIntent it does not have (another account or mode): nothing to sweep. */
export function isUnknownToStripe(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'resource_missing';
}

/** The cents already refunded on a PaymentIntent's charge (`latest_charge` expanded); 0 when it is not expanded. */
export function refundedCents(latestCharge: unknown): number {
  if (typeof latestCharge !== 'object' || latestCharge === null) return 0;
  const refunded = (latestCharge as { amount_refunded?: unknown }).amount_refunded;
  return typeof refunded === 'number' && Number.isInteger(refunded) ? refunded : 0;
}

/** Runs `work` over `items`, `size` at a time: a few Stripe calls in parallel keep a run of 20 within seconds. */
export async function inGroups<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

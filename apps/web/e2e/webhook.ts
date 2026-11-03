import { createHmac, randomBytes } from 'node:crypto';

import { test, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Stripe webhook helpers for the launch QA tests (§8 items 6 and 7). A `payment_intent.succeeded` event is signed with
 * the server's own test webhook secret (STRIPE_WEBHOOK_SECRET in apps/web/.env.local, `whsec_…`) exactly as Stripe
 * signs it, so the handler's real code runs (signature, claim, finalize, which asks Stripe about the PaymentIntent).
 */

export const webhookSecretPresent = (): boolean => (process.env.STRIPE_WEBHOOK_SECRET ?? '').startsWith('whsec_');

/** The run asked for the tests that need `stripe listen` (`--grep @stripe-listen`, see webhook.spec.ts). Call inside a test. */
export const stripeListenRun = (): boolean => /stripe-listen/.test(String(test.info().config.grep));

export const newEventId = (): string => `evt_e2e_${randomBytes(12).toString('hex')}`;

/** POSTs a signed payment_intent.succeeded event for a real (test-mode) PaymentIntent. */
export async function sendSucceededEvent(
  request: APIRequestContext,
  eventId: string,
  paymentIntentId: string,
): Promise<{ status: number; body: { received?: boolean; duplicate?: boolean; error?: string } }> {
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'payment_intent.succeeded',
    data: { object: { id: paymentIntentId, object: 'payment_intent', status: 'succeeded', livemode: false, metadata: {} } },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET ?? '').update(`${t}.${payload}`).digest('hex');
  const res = await request.post('/api/webhooks/stripe', {
    data: payload,
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
  });
  return { status: res.status(), body: (await res.json().catch(() => ({}))) as { received?: boolean; duplicate?: boolean } };
}

/**
 * Writes a webhook claim straight into `webhook_events`, as a handler that died after claiming would leave it.
 * Untyped client on purpose: the columns are F-1's (`status` 'processing' | 'done', `claimed_at`), which the generated
 * types gain only once that migration lands. Local database only (env.ts checked it in global setup).
 */
export async function writeClaim(eventId: string, status: 'processing' | 'done', claimedAgoMs: number): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const loose = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await loose.from('webhook_events').insert({
    event_id: eventId,
    event_type: 'payment_intent.succeeded',
    status,
    claimed_at: new Date(Date.now() - claimedAgoMs).toISOString(),
  });
  if (error) throw new Error(`Could not write a ${status} claim (F-1's webhook_events columns missing?): ${error.message}`);
}

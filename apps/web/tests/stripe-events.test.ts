import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  handleExtraEvent,
  isExtraEvent,
  REFUND_SETTLE_MS,
  type StripeEventDeps,
} from '../app/api/webhooks/stripe/events';

import type { DisputeInput, DisputeResult, StripeRefundResult } from '@repo/db/server';
import type Stripe from 'stripe';

const NOW = 1_800_000_000_000;

function fakeDeps(over: { refund?: StripeRefundResult; dispute?: DisputeResult } = {}) {
  const log = {
    refunds: [] as unknown[],
    disputes: [] as DisputeInput[],
    alerts: [] as { title: string; fields: Record<string, unknown> }[],
    warns: [] as string[],
    sleeps: [] as number[],
    deferred: [] as string[],
  };
  const deps: StripeEventDeps = {
    recordRefund: async (input) => {
      log.refunds.push(input);
      return over.refund ?? { found: true, order_number: 'IWC-1', applied_cents: 1000, refunded_cents: 1000, total_cents: 5400 };
    },
    recordDispute: async (input) => {
      log.disputes.push(input);
      return over.dispute ?? { is_new: true, order_number: 'IWC-2', closed: false };
    },
    deferSweep: async (id) => {
      log.deferred.push(id);
    },
    alert: async (title, fields) => {
      log.alerts.push({ title, fields });
      return true;
    },
    warn: (event) => log.warns.push(event),
    sleep: async (ms) => {
      log.sleeps.push(ms);
    },
    now: () => NOW,
  };
  return { deps, log };
}

const event = (type: string, object: object, createdMs = NOW - 60_000): Stripe.Event =>
  ({ id: 'evt_1', type, created: Math.floor(createdMs / 1000), data: { object } }) as unknown as Stripe.Event;

const charge = { id: 'ch_1', payment_intent: 'pi_1', amount_refunded: 1000, refunds: { data: [{ id: 're_1' }] } };
const dispute = {
  id: 'dp_1',
  payment_intent: 'pi_2',
  charge: 'ch_2',
  amount: 5400,
  currency: 'usd',
  reason: 'fraudulent',
  status: 'needs_response',
  evidence_details: { due_by: Math.floor(NOW / 1000) + 7 * 86400 },
};

describe('Stripe event routing (F-3)', () => {
  it('knows its events', () => {
    assert.ok(isExtraEvent('charge.refunded'));
    assert.ok(isExtraEvent('charge.dispute.created'));
    assert.ok(isExtraEvent('payment_intent.payment_failed'));
    assert.ok(!isExtraEvent('payment_intent.succeeded'));
    assert.ok(!isExtraEvent('customer.created'));
  });

  it('a refund made in Stripe reaches the order and alerts the founder', async () => {
    const { deps, log } = fakeDeps();
    assert.equal(await handleExtraEvent(event('charge.refunded', charge), deps), 'refund_recorded');
    assert.deepEqual(log.refunds, [{ paymentIntentId: 'pi_1', refundedCents: 1000, refundId: 're_1' }]);
    assert.equal(log.alerts.length, 1);
    assert.match(log.alerts[0]!.title, /IWC-1/);
    assert.equal(log.alerts[0]!.fields.refunded, '$10.00');
    assert.deepEqual(log.sleeps, []);
  });

  it('a fresh refund waits for the admin’s own record first', async () => {
    const { deps, log } = fakeDeps();
    await handleExtraEvent(event('charge.refunded', charge, NOW - 5000), deps);
    assert.deepEqual(log.sleeps, [REFUND_SETTLE_MS - 5000]);
  });

  it('a refund already counted (the admin made it) sends nothing', async () => {
    const { deps, log } = fakeDeps({
      refund: { found: true, order_number: 'IWC-1', applied_cents: 0, refunded_cents: 1000, total_cents: 5400 },
    });
    assert.equal(await handleExtraEvent(event('charge.refunded', charge), deps), 'refund_already_counted');
    assert.equal(log.alerts.length, 0);
  });

  it('a refund without an order (refused at checkout) is only logged', async () => {
    const { deps, log } = fakeDeps({ refund: { found: false } });
    assert.equal(await handleExtraEvent(event('charge.refunded', charge), deps), 'refund_without_order');
    assert.equal(log.alerts.length, 0);
    assert.deepEqual(log.warns, ['stripe.refund_without_order']);
  });

  it('a new dispute alerts immediately with amount, reason and due date', async () => {
    const { deps, log } = fakeDeps();
    assert.equal(await handleExtraEvent(event('charge.dispute.created', dispute), deps), 'dispute_recorded');
    assert.equal(log.disputes[0]!.paymentIntentId, 'pi_2');
    assert.equal(log.disputes[0]!.amountCents, 5400);
    assert.equal(log.alerts.length, 1);
    assert.match(log.alerts[0]!.title, /Dispute opened on order IWC-2/);
    assert.equal(log.alerts[0]!.fields.amount, '$54.00');
    assert.equal(log.alerts[0]!.fields.reason, 'fraudulent');
    assert.match(String(log.alerts[0]!.fields.respondBy), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('a dispute seen before does not alert twice', async () => {
    const { deps, log } = fakeDeps({ dispute: { is_new: false, order_number: 'IWC-2', closed: false } });
    await handleExtraEvent(event('charge.dispute.created', dispute), deps);
    assert.equal(log.alerts.length, 0);
  });

  it('a closed dispute says how it ended', async () => {
    const { deps, log } = fakeDeps({ dispute: { is_new: false, order_number: 'IWC-2', closed: true } });
    const won = { ...dispute, status: 'won' };
    assert.equal(await handleExtraEvent(event('charge.dispute.closed', won), deps), 'dispute_closed');
    assert.match(log.alerts[0]!.title, /Dispute won: order IWC-2/);
  });

  it('a failed payment is logged with codes only and the sweep is deferred', async () => {
    const { deps, log } = fakeDeps();
    const intent = { id: 'pi_3', last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' } };
    assert.equal(await handleExtraEvent(event('payment_intent.payment_failed', intent), deps), 'payment_failed');
    assert.deepEqual(log.warns, ['stripe.payment_failed']);
    assert.deepEqual(log.deferred, ['pi_3']);
    assert.equal(log.alerts.length, 0);
  });

  it('a recording failure is thrown, so the route lets Stripe retry', async () => {
    const { deps } = fakeDeps();
    deps.recordDispute = async () => {
      throw new Error('database busy');
    };
    await assert.rejects(handleExtraEvent(event('charge.dispute.created', dispute), deps), /database busy/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyOrderResult,
  nextDelayMs,
  pollOrder,
  POLL_DELAYS_MS,
  type OrderOutcome,
} from '../features/checkout/order-confirm';

const failed = (
  status: number | null,
  serverMessage: string | null = null,
  retryAfterSeconds: number | null = null,
) =>
  ({
    ok: false,
    status,
    message: serverMessage ?? 'x',
    serverMessage,
    retryAfterSeconds,
    timedOut: false,
  }) as const;

describe('order confirmation outcomes (launch QA A-2, A-4)', () => {
  it('an order number is confirmed', () => {
    assert.deepEqual(
      classifyOrderResult({ ok: true, status: 200, data: { orderNumber: 'IWC-7' } }),
      {
        kind: 'confirmed',
        orderNumber: 'IWC-7',
      },
    );
  });

  it('a 409 is a refusal with its refund message', () => {
    assert.deepEqual(
      classifyOrderResult(failed(409, 'Sorry, an item sold out. Refunded in full.')),
      {
        kind: 'refused',
        message: 'Sorry, an item sold out. Refunded in full.',
      },
    );
  });

  it('a 400 is final', () => {
    assert.deepEqual(classifyOrderResult(failed(400, 'Invalid request.')), { kind: 'unconfirmed' });
  });

  it('202, 429, 500, 503, 504 and no answer all mean ask again', () => {
    for (const status of [202, 429, 500, 503, 504, null]) {
      assert.equal(classifyOrderResult(failed(status)).kind, 'waiting', String(status));
    }
    assert.deepEqual(classifyOrderResult(failed(503, 'busy', 30)), {
      kind: 'waiting',
      retryAfterSeconds: 30,
    });
  });
});

/** A fake clock: records each pause instead of sleeping. */
function harness(answers: OrderOutcome[]) {
  const waits: number[] = [];
  let calls = 0;
  return {
    waits,
    calls: () => calls,
    confirm: () => {
      const answer = answers[Math.min(calls, answers.length - 1)]!;
      calls += 1;
      return Promise.resolve(answer);
    },
    wait: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

const waiting: OrderOutcome = { kind: 'waiting', retryAfterSeconds: null };

describe('the thank-you page asks again with back-off', () => {
  it('backs off 2, 4, 8, 16, 30 s (about a minute) and then gives up', async () => {
    const h = harness([waiting]);
    const outcome = await pollOrder('pi_1', {
      signal: new AbortController().signal,
      confirm: h.confirm,
      wait: h.wait,
    });
    assert.deepEqual(outcome, { kind: 'gave_up' });
    assert.deepEqual(h.waits, [...POLL_DELAYS_MS]);
    assert.equal(
      h.waits.reduce((a, b) => a + b, 0),
      60_000,
    );
    assert.equal(h.calls(), POLL_DELAYS_MS.length + 1);
  });

  it('shows the number as soon as it exists (500 for a while, then OK)', async () => {
    const h = harness([waiting, waiting, { kind: 'confirmed', orderNumber: 'IWC-3' }]);
    const outcome = await pollOrder('pi_1', {
      signal: new AbortController().signal,
      confirm: h.confirm,
      wait: h.wait,
    });
    assert.deepEqual(outcome, { kind: 'confirmed', orderNumber: 'IWC-3' });
    assert.deepEqual(h.waits, [2_000, 4_000]);
  });

  it('stops at once on a refusal', async () => {
    const h = harness([{ kind: 'refused', message: 'Refunded.' }]);
    const outcome = await pollOrder('pi_1', {
      signal: new AbortController().signal,
      confirm: h.confirm,
      wait: h.wait,
    });
    assert.deepEqual(outcome, { kind: 'refused', message: 'Refunded.' });
    assert.equal(h.waits.length, 0);
  });

  it('waits longer when the server asks (Retry-After), at most 30 s', async () => {
    assert.equal(nextDelayMs(2_000, null), 2_000);
    assert.equal(nextDelayMs(2_000, 10), 10_000);
    assert.equal(nextDelayMs(2_000, 600), 30_000);
    assert.equal(nextDelayMs(16_000, 1), 16_000);
  });

  it('stops quietly when the page is left', async () => {
    const controller = new AbortController();
    const h = harness([waiting]);
    const outcome = await pollOrder('pi_1', {
      signal: controller.signal,
      confirm: h.confirm,
      wait: (ms) => {
        controller.abort();
        return h.wait(ms);
      },
    });
    assert.equal(outcome, null);
    assert.equal(h.calls(), 1);
  });
});

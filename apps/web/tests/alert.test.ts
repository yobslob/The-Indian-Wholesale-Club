import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  alertDollars,
  alertText,
  resetAlertThrottle,
  safeFields,
  sendAlert,
  sendThrottledAlert,
  shouldAlert,
} from '../lib/alert';

const URL = 'https://hooks.example.test/alert';

type Call = { url: string; init: RequestInit };
function recorder(response: () => Promise<Response>): { calls: Call[]; fetchImpl: typeof fetch } {
  const calls: Call[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return response();
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('alert text (no personal data)', () => {
  it('drops contact keys and hides emails and phone numbers inside values', () => {
    const fields = safeFields({
      email: 'a@b.com',
      customerEmail: 'a@b.com',
      phone: '+1 555 123 4567',
      shippingAddress: '1 Main St',
      recipient: 'x',
      orderNumber: 'IWC-261103-CB8C62FD00',
      paymentIntentId: 'pi_3Nabc1234567890XYZ',
      error: 'duplicate key (email)=(priya@example.com) call 555-123-4567',
      amountCents: 5400,
      nested: { email: 'a@b.com' },
    });
    assert.deepEqual(Object.keys(fields).sort(), ['amountCents', 'error', 'orderNumber', 'paymentIntentId']);
    assert.equal(fields.orderNumber, 'IWC-261103-CB8C62FD00');
    assert.equal(fields.paymentIntentId, 'pi_3Nabc1234567890XYZ');
    assert.ok(!fields.error!.includes('priya@example.com'));
    assert.ok(!fields.error!.includes('555-123-4567'));
  });

  it('is short, titled and in dollars', () => {
    const text = alertText('Dispute opened', { amount: alertDollars(5400), reason: 'fraudulent' });
    assert.equal(text, 'IWC: Dispute opened\namount: $54.00\nreason: fraudulent');
    assert.ok(alertText('x', { long: 'y'.repeat(5000) }).length <= 1800);
  });
});

describe('sendAlert', () => {
  it('posts text and content as JSON to the hook', async () => {
    const { calls, fetchImpl } = recorder(async () => new Response('ok'));
    assert.equal(await sendAlert('Hello', { orderNumber: 'IWC-1' }, { url: URL, fetchImpl }), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, URL);
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, string>;
    assert.deepEqual(Object.keys(body).sort(), ['content', 'text']);
    assert.equal(body.text, 'IWC: Hello\norderNumber: IWC-1');
  });

  it('sends nothing without a URL', async () => {
    const saved = process.env.ADMIN_ALERT_WEBHOOK_URL;
    delete process.env.ADMIN_ALERT_WEBHOOK_URL;
    const { calls, fetchImpl } = recorder(async () => new Response('ok'));
    assert.equal(await sendAlert('Hello', {}, { fetchImpl }), false);
    assert.equal(calls.length, 0);
    if (saved !== undefined) process.env.ADMIN_ALERT_WEBHOOK_URL = saved;
  });

  it('never throws: network errors and error statuses resolve false', async () => {
    const failing = recorder(() => Promise.reject(new TypeError('fetch failed')));
    assert.equal(await sendAlert('x', {}, { url: URL, fetchImpl: failing.fetchImpl }), false);
    const rejected = recorder(async () => new Response('no', { status: 500 }));
    assert.equal(await sendAlert('x', {}, { url: URL, fetchImpl: rejected.fetchImpl }), false);
    const throwing = (() => {
      throw new Error('sync');
    }) as unknown as typeof fetch;
    assert.equal(await sendAlert('x', {}, { url: URL, fetchImpl: throwing }), false);
  });

  it('gives up at its time limit', async () => {
    const hanging = ((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as unknown as typeof fetch;
    // AbortSignal.timeout's timer doesn't keep Node running: this one does, until the abort has come
    const awake = setInterval(() => undefined, 1000);
    try {
      const started = Date.now();
      assert.equal(await sendAlert('x', {}, { url: URL, fetchImpl: hanging, timeoutMs: 50 }), false);
      assert.ok(Date.now() - started < 2000);
    } finally {
      clearInterval(awake);
    }
  });
});

describe('throttle', () => {
  beforeEach(() => resetAlertThrottle());

  it('lets one alert per key through per window', () => {
    assert.equal(shouldAlert('route:/a', 0), true);
    assert.equal(shouldAlert('route:/a', 60_000), false);
    assert.equal(shouldAlert('route:/b', 60_000), true);
    assert.equal(shouldAlert('route:/a', 10 * 60_000), true);
  });

  it('keeps its memory bounded', () => {
    for (let i = 0; i < 2000; i += 1) shouldAlert(`k${i}`, 1000);
    assert.equal(shouldAlert('k1999', 1000), false);
    assert.equal(shouldAlert('fresh', 1000), true);
  });

  it('sendThrottledAlert posts once for repeated errors', async () => {
    const { calls, fetchImpl } = recorder(async () => new Response('ok'));
    const results = await Promise.all(
      [1, 2, 3].map(() => sendThrottledAlert('log:stripe.webhook_failed', 'stripe.webhook_failed', {}, { url: URL, fetchImpl })),
    );
    assert.deepEqual(results, [true, false, false]);
    assert.equal(calls.length, 1);
  });
});

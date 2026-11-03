import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { z } from 'zod';

import { interpretResponse, MESSAGES, postJson } from '../features/checkout/http';

const okSchema = z.object({ orderNumber: z.string() });

describe('checkout API answers become messages, never throws (launch QA A-2, A-3)', () => {
  it('reads a success body', () => {
    const r = interpretResponse(200, '{"orderNumber":"IWC-1"}', null, okSchema);
    assert.deepEqual(r, { ok: true, status: 200, data: { orderNumber: 'IWC-1' } });
  });

  it('shows the server message of a JSON error', () => {
    const r = interpretResponse(
      409,
      '{"error":"Some items in your bag just sold out."}',
      null,
      okSchema,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.message, 'Some items in your bag just sold out.');
      assert.equal(r.serverMessage, 'Some items in your bag just sold out.');
    }
  });

  it('keeps the 503 message and its Retry-After (a slow database)', () => {
    const r = interpretResponse(
      503,
      '{"error":"We are busy, try again in a minute."}',
      '30',
      okSchema,
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.message, 'We are busy, try again in a minute.');
      assert.equal(r.retryAfterSeconds, 30);
    }
  });

  it('a gateway HTML page reads as a server problem', () => {
    const r = interpretResponse(504, '<html><body>Gateway Timeout</body></html>', null, okSchema);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.message, MESSAGES.server);
      assert.equal(r.serverMessage, null);
    }
  });

  it('a 429 without a body says to wait', () => {
    const r = interpretResponse(429, '', '12', okSchema);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.message, MESSAGES.busy);
      assert.equal(r.retryAfterSeconds, 12);
    }
  });

  it('a 2xx without the success shape is not a success (202 still processing)', () => {
    const r = interpretResponse(
      202,
      '{"error":"Your payment is still processing."}',
      null,
      okSchema,
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 202);
  });

  it('a dropped connection becomes the connection message', async () => {
    const fetchImpl: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await postJson('/api/orders', {}, okSchema, { timeoutMs: 1000, fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, null);
      assert.equal(r.message, MESSAGES.offline);
      assert.equal(r.timedOut, false);
    }
  });

  it('a request that takes too long is cut off and says so', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const r = await postJson('/api/checkout', {}, okSchema, { timeoutMs: 20, fetchImpl });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.timedOut, true);
      assert.equal(r.message, MESSAGES.timeout);
    }
  });

  it('posts JSON and reads the answer', async () => {
    let sent = '';
    const fetchImpl: typeof fetch = (_url, init) => {
      sent = String(init?.body);
      return Promise.resolve(new Response('{"orderNumber":"IWC-9"}', { status: 200 }));
    };
    const r = await postJson('/api/orders', { paymentIntentId: 'pi_1' }, okSchema, {
      timeoutMs: 1000,
      fetchImpl,
    });
    assert.equal(sent, '{"paymentIntentId":"pi_1"}');
    assert.deepEqual(r, { ok: true, status: 200, data: { orderNumber: 'IWC-9' } });
  });
});

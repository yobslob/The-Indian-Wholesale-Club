import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { rateLimit } from '../lib/rate-limit-memory';

describe('rateLimit (sliding window)', () => {
  const rule = { limit: 2, windowMs: 1000 };

  it('allows up to the limit, then refuses with a retry time', () => {
    assert.equal(rateLimit('a', rule, 0).ok, true);
    assert.equal(rateLimit('a', rule, 10).ok, true);
    const third = rateLimit('a', rule, 20);
    assert.equal(third.ok, false);
    assert.equal(third.retryAfterSeconds, 1);
  });

  it('allows again once the window has passed, and keys are independent', () => {
    assert.equal(rateLimit('a', rule, 1001).ok, true);
    assert.equal(rateLimit('b', rule, 20).ok, true);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isRobotCheck,
  mayClearByItself,
  retryAfterMs,
} from '../src/sourcing/auto';

const page = (
  shown: string,
  headers: Record<string, string> = {},
  status: number | null = 200,
) => ({
  status,
  headers,
  shown,
});

describe('robot checks (D-149)', () => {
  it("knows Blinkit's Cloudflare block by its header and its words", () => {
    const blinkit = page(
      'Just a moment... access denied sorry, you have been blocked! The page you are trying to access has blocked you',
      { 'cf-mitigated': 'challenge', server: 'cloudflare' },
      403,
    );
    assert.equal(isRobotCheck(blinkit), true);
    assert.equal(mayClearByItself(blinkit), true);
    assert.equal(isRobotCheck(page('sorry, you have been blocked!', {}, 403)), true);
  });

  it('leaves a normal results page alone, even one that names a captcha far down', () => {
    assert.equal(
      isRobotCheck(page('Buy makhana Online | blinkit Showing results for "makhana" 55 g ₹203')),
      false,
    );
    assert.equal(isRobotCheck(page(`${'Makhana ₹99 ADD '.repeat(300)} captcha`)), false);
  });

  it("a plain refusal does not clear by itself; Cloudflare's interstitial may", () => {
    assert.equal(mayClearByItself(page('Access denied')), false);
    assert.equal(mayClearByItself(page('Just a moment...')), true);
  });
});

describe("a shop's Retry-After, for the log (D-153, D-158: nothing rests on it)", () => {
  const now = new Date('2026-10-22T22:13:23Z');

  it('reads Retry-After as seconds or a date, and nothing else', () => {
    assert.equal(retryAfterMs({ 'retry-after': '73954' }, now), 73_954_000);
    assert.equal(retryAfterMs({ 'retry-after': 'Thu, 22 Oct 2026 22:23:23 GMT' }, now), 600_000);
    assert.equal(retryAfterMs({}, now), null);
    assert.equal(retryAfterMs({ 'retry-after': 'soon' }, now), null);
  });
});

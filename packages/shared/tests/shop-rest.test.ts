import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isRobotCheck,
  mayClearByItself,
  nextRest,
  paceWaitMs,
  restingUntil,
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

describe('shop rests (D-149)', () => {
  const now = new Date('2026-10-23T02:00:00Z');
  const hours = (iso: string) => (Date.parse(iso) - now.getTime()) / 3600_000;

  it('rests 2 h the first time, 6 h then 24 h when it blocks again within two days', () => {
    const first = nextRest('blinkit.com', undefined, now);
    assert.deepEqual([first.times, hours(first.until)], [1, 2]);
    const second = nextRest('blinkit.com', { ...first, since: '2026-10-22T10:00:00Z' }, now);
    assert.deepEqual([second.times, hours(second.until)], [2, 6]);
    const third = nextRest('blinkit.com', second, now);
    assert.deepEqual([third.times, hours(third.until)], [3, 24]);
    assert.equal(hours(nextRest('blinkit.com', third, now).until), 24);
  });

  it('starts again at 2 h after two quiet days', () => {
    const old = {
      site: 'blinkit.com',
      until: '2026-10-20T06:00:00Z',
      times: 3,
      since: '2026-10-20T00:00:00Z',
    };
    assert.equal(nextRest('blinkit.com', old, now).times, 1);
  });

  it('is resting only until its time', () => {
    const rest = nextRest('blinkit.com', undefined, now);
    assert.ok(restingUntil(rest, new Date('2026-10-23T03:00:00Z')));
    assert.equal(restingUntil(rest, new Date('2026-10-23T04:00:01Z')), null);
    assert.equal(restingUntil(undefined, now), null);
  });
});

describe("a shop's own Retry-After and an hourly pace (D-153)", () => {
  const now = new Date('2026-10-22T22:13:23Z');
  const hours = (iso: string) => (Date.parse(iso) - now.getTime()) / 3600_000;

  it('rests as long as the shop asked, never past two days', () => {
    const asked = retryAfterMs({ 'retry-after': '73954' }, now);
    assert.equal(asked, 73_954_000);
    assert.equal(
      Math.round(hours(nextRest('blinkit.com', undefined, now, asked).until) * 10) / 10,
      20.5,
    );
    assert.equal(hours(nextRest('blinkit.com', undefined, now, 9 * 24 * 3600_000).until), 48);
    assert.equal(hours(nextRest('blinkit.com', undefined, now, 60_000).until), 2);
  });

  it('reads Retry-After as seconds or a date, and nothing else', () => {
    assert.equal(retryAfterMs({ 'retry-after': 'Thu, 22 Oct 2026 22:23:23 GMT' }, now), 600_000);
    assert.equal(retryAfterMs({}, now), null);
    assert.equal(retryAfterMs({ 'retry-after': 'soon' }, now), null);
  });

  it('waits only once the last hour holds the limit, until the oldest of them ages out', () => {
    const t = now.getTime();
    const minutesAgo = (m: number) => t - m * 60_000;
    assert.equal(paceWaitMs([minutesAgo(1), minutesAgo(2)], t, 3), 0);
    assert.equal(paceWaitMs([minutesAgo(1), minutesAgo(2), minutesAgo(50)], t, 3), 10 * 60_000);
    assert.equal(paceWaitMs([minutesAgo(1), minutesAgo(2), minutesAgo(61)], t, 3), 0);
    assert.equal(
      paceWaitMs(
        Array.from({ length: 500 }, () => t),
        t,
        undefined,
      ),
      0,
    );
  });
});

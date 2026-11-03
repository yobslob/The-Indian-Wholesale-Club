import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decodeBagFragment, encodeBagFragment, mergedQuantity } from '../features/cart/bag-fragment';
import { bounceHtml, bounceScript } from '../lib/legacy-bounce';
import { isPagePath, legacyMove, parseHosts, type MoveRequest } from '../lib/legacy-move';

const OLD = 'the-indian-wholesale-club.vercel.app';
const HOSTS = parseHosts(` ${OLD.toUpperCase()}:443 , iwc-new.vercel.app,`);
const DOMAIN = 'https://indianwholesaleclub.com';
const A = '0b6a6c2e-1f3d-4c1a-9a51-2c7d1f7e9a01';
const B = 'f3c1d2e4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const req = (over: Partial<MoveRequest> = {}): MoveRequest => ({
  host: OLD,
  method: 'GET',
  pathname: '/food',
  search: '',
  navigate: false,
  userAgent: 'curl/8.4',
  moved: false,
  ...over,
});

describe('legacy host move (E-1, DOM-1)', () => {
  it('parses LEGACY_HOSTS without ports, case or blanks', () => {
    assert.deepEqual([...HOSTS], [OLD, 'iwc-new.vercel.app']);
    assert.equal(parseHosts(undefined).size, 0);
  });

  it('sends a page GET or HEAD on a listed host to the domain with 308, path and query kept', () => {
    assert.deepEqual(legacyMove(req({ search: '?state=kerala' }), HOSTS, DOMAIN), {
      kind: 'redirect',
      location: `${DOMAIN}/food?state=kerala`,
    });
    assert.equal(legacyMove(req({ method: 'HEAD', pathname: '/' }), HOSTS, DOMAIN).kind, 'redirect');
    assert.equal(legacyMove(req({ host: `${OLD}:443` }), HOSTS, `${DOMAIN}/`).kind, 'redirect');
  });

  it('serves the webhook, the API, photos, auth, Next files, files and every other method as they are', () => {
    for (const pathname of ['/api/webhooks/stripe', '/api', '/media/s/a.avif', '/auth/callback', '/_next/static/x.js', '/robots.txt', '/sitemap.xml', '/email/logo.png']) {
      assert.equal(legacyMove(req({ pathname }), HOSTS, DOMAIN).kind, 'serve', pathname);
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      assert.equal(legacyMove(req({ method }), HOSTS, DOMAIN).kind, 'serve', method);
    }
  });

  it('never moves an unlisted host: the domain, a preview deployment, localhost', () => {
    for (const host of ['indianwholesaleclub.com', 'iwc-git-branch-team.vercel.app', 'localhost:3000', null]) {
      assert.equal(legacyMove(req({ host }), HOSTS, DOMAIN).kind, 'serve', String(host));
    }
    // the domain listed by mistake would loop
    assert.equal(legacyMove(req({ host: 'indianwholesaleclub.com' }), parseHosts('indianwholesaleclub.com'), DOMAIN).kind, 'serve');
  });

  it("bounces a person's first browser visit (to carry the bag), then 308 once the cookie is set", () => {
    const person = { navigate: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130' };
    assert.equal(legacyMove(req(person), HOSTS, DOMAIN).kind, 'bounce');
    assert.equal(legacyMove(req({ ...person, moved: true }), HOSTS, DOMAIN).kind, 'redirect');
    assert.equal(legacyMove(req({ ...person, userAgent: 'Googlebot/2.1' }), HOSTS, DOMAIN).kind, 'redirect');
  });

  it('knows a page from a file or a served prefix', () => {
    assert.equal(isPagePath('/states/kerala/silk-saree'), true);
    assert.equal(isPagePath('/'), true);
    assert.equal(isPagePath('/apiary'), true);
    assert.equal(isPagePath('/sitemaps/products-0.xml'), false);
  });
});

describe('bag fragment (E-1)', () => {
  it('round-trips ids and quantities, capped, each variant once', () => {
    const frag = encodeBagFragment([
      { variantId: A.toUpperCase(), quantity: 2 },
      { variantId: B, quantity: 40 },
      { variantId: 'not-a-uuid', quantity: 1 },
      { variantId: A, quantity: 0 },
    ]);
    assert.ok(frag?.startsWith('#bag='));
    assert.match(frag ?? '', /^#bag=[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeBagFragment(frag ?? ''), [
      { variantId: A, quantity: 2 },
      { variantId: B, quantity: 10 },
    ]);
  });

  it('reads nothing from an empty bag, another fragment or garbage', () => {
    assert.equal(encodeBagFragment([]), null);
    for (const hash of ['', '#top', '#bag=', '#bag=%%%', `#bag=${btoa('x:1,<script>')}`]) {
      assert.deepEqual(decodeBagFragment(hash), [], hash);
    }
  });

  it('merges at the larger quantity, never the sum', () => {
    assert.equal(mergedQuantity(3, 2), 3);
    assert.equal(mergedQuantity(0, 4), 4);
    assert.equal(mergedQuantity(9, 12), 10);
  });
});

/** Runs the bounce page's script against a fake localStorage and location. */
function runBounce(stored: unknown, hash = ''): string {
  let went = '';
  const storage = { getItem: () => (stored === undefined ? null : JSON.stringify(stored)) };
  const location = { hash, replace: (to: string) => (went = to) };
  new Function('localStorage', 'location', 'btoa', bounceScript(`${DOMAIN}/food?x=1`))(storage, location, btoa);
  return went;
}

describe('the bounce page (E-1)', () => {
  it('carries the stored bag in the same fragment encodeBagFragment writes', () => {
    const lines = [
      { variantId: A, quantity: 2, productName: 'Kasavu saree', unitPriceCents: 9900 },
      { variantId: B, quantity: 30 },
    ];
    assert.equal(runBounce({ state: { lines }, version: 1 }), `${DOMAIN}/food?x=1${encodeBagFragment(lines)}`);
  });

  it('goes on without a bag, keeping any other fragment, and survives a broken store', () => {
    assert.equal(runBounce(undefined), `${DOMAIN}/food?x=1`);
    assert.equal(runBounce({ state: { lines: [] } }, '#reviews'), `${DOMAIN}/food?x=1#reviews`);
    assert.equal(runBounce('not json'), `${DOMAIN}/food?x=1`);
  });

  it('escapes the address in the script and the markup', () => {
    const html = bounceHtml(`${DOMAIN}/x"><script>alert(1)</script>`);
    assert.ok(!html.includes('"><script>alert'));
    assert.ok(html.includes('rel="canonical"'));
    assert.ok(html.includes('noindex'));
  });
});

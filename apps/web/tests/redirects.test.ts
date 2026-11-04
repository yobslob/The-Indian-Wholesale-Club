import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

import { compile, pathToRegexp, type Key } from 'next/dist/compiled/path-to-regexp';

interface Rule {
  source: string;
  destination: string;
  permanent: boolean;
}

const require_ = createRequire(__filename);
const config = require_('../next.config.js') as {
  redirects: () => Promise<Rule[]>;
  rewrites: () => Promise<{ beforeFiles: { source: string; destination: string; has?: { key: string }[] }[] }>;
};

/** Where an address lands: the first rule that matches wins, as in Next. Null: no rule, the page itself answers. */
function land(rules: Rule[], path: string): string | null {
  for (const r of rules) {
    const keys: Key[] = [];
    const m = pathToRegexp(r.source, keys).exec(path);
    if (!m) continue;
    assert.equal(r.permanent, true, r.source);
    const params: Record<string, string | string[]> = {};
    keys.forEach((k, i) => {
      if (m[i + 1] !== undefined) params[String(k.name)] = k.modifier === '*' ? m[i + 1]!.split('/') : m[i + 1]!;
    });
    const [dest, query] = r.destination.split('?') as [string, string | undefined];
    const to = compile(dest)(params);
    return query ? `${to}?${compile(query, { validate: false })(params)}` : to;
  }
  return null;
}

describe('old addresses (D-187), most specific first', () => {
  const table: [string, string | null][] = [
    ['/7-day-delivery', '/food'],
    ['/7-day-delivery/search', '/search'],
    ['/7-day-delivery/food', '/food'],
    ['/7-day-delivery/home-and-gifts', '/home-and-gifts'],
    ['/7-day-delivery/food/all', '/food'],
    ['/7-day-delivery/food/sweets', '/food?category=sweets'],
    ['/7-day-delivery/home-and-gifts/pooja-and-spiritual', '/home-and-gifts?category=pooja-and-spiritual'],
    ['/vendor', '/'],
    ['/vendor/login', '/'],
    ['/vendor/pieces/123', '/'],
    ['/spices', '/food'],
    // not touched
    ['/food', null],
    ['/search', null],
    ['/states/kerala', null],
    ['/7-day-delivery/clothing', null],
  ];
  for (const [from, to] of table) {
    it(`${from} → ${to ?? '(the page itself)'}`, async () => {
      assert.equal(land(await config.redirects(), from), to);
    });
  }
});

describe("See all's cached route (R-6)", () => {
  it('has no ?show= rule and no [show] segment: an old ?show= link lands on the first page', async () => {
    const { beforeFiles } = await config.rewrites();
    const seeAll = beforeFiles.filter((r) => r.destination.startsWith('/see-all/'));
    assert.equal(seeAll.length, 8, 'state, category and for, each with or without');
    for (const r of seeAll) {
      assert.equal(r.destination.split('/').length, 6, r.destination);
      assert.ok(!(r.has ?? []).some((h) => h.key === 'show'));
    }
    assert.ok(!beforeFiles.some((r) => r.source.includes('7-day')));
  });
});

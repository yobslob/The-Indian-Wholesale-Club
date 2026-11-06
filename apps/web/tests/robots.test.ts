import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import robots from '../app/robots';

type Rule = { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[] };

const rules = robots().rules as Rule[];
const everyone = rules.find((r) => r.userAgent === '*');

describe('robots.txt (D-189)', () => {
  it('keeps crawlers off filter addresses, which are each a page in the page cache', () => {
    for (const path of ['/clothing?', '/food?', '/home-and-gifts?', '/see-all/', '/states/*?']) {
      assert.ok(everyone?.disallow?.includes(path), path);
    }
  });

  it('leaves the pages that bring customers open to search engines', () => {
    assert.equal(everyone?.allow, '/');
    for (const path of ['/clothing', '/food', '/home-and-gifts', '/states/', '/']) {
      assert.ok(!everyone?.disallow?.includes(path), path);
    }
    const blocked = rules.find((r) => r.userAgent !== '*')?.userAgent ?? [];
    for (const bot of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot']) {
      assert.ok(!blocked.includes(bot), bot);
    }
  });

  it('never names the admin (D-006)', () => {
    assert.ok(!JSON.stringify(robots()).includes('admin'));
  });
});

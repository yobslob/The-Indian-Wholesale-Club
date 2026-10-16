import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { amazonSearchUrl, flipkartSearchUrl, searchPages } from '../src/sourcing/auto';

/** D-137: Amazon and Flipkart searches use the shop's own price filter and read more pages for a big target. */
describe('marketplace search pages (D-137)', () => {
  it('reads one page for a few listings and up to four for many', () => {
    assert.equal(searchPages(0), 1);
    assert.equal(searchPages(6), 1);
    assert.equal(searchPages(15), 2);
    assert.equal(searchPages(40), 4);
    assert.equal(searchPages(400), 4);
  });

  it("puts the band in Amazon's price filter, in paise", () => {
    const url = new URL(amazonSearchUrl('brass diya', { minPaise: 100, maxPaise: 30000 }, 2));
    assert.equal(url.origin + url.pathname, 'https://www.amazon.in/s');
    assert.equal(url.searchParams.get('k'), 'brass diya');
    assert.equal(url.searchParams.get('rh'), 'p_36:100-30000');
    assert.equal(url.searchParams.get('page'), '2');
    const open = new URL(amazonSearchUrl('diya', { minPaise: null, maxPaise: null }));
    assert.equal(open.searchParams.get('rh'), null);
    assert.equal(open.searchParams.get('page'), null);
    assert.equal(
      new URL(amazonSearchUrl('diya', { minPaise: 50000, maxPaise: null })).searchParams.get('rh'),
      'p_36:50000-',
    );
  });

  it("puts the band in Flipkart's price filter, in rupees", () => {
    const url = new URL(flipkartSearchUrl('namkeen', { minPaise: 100, maxPaise: 30000 }, 3));
    assert.equal(url.searchParams.get('q'), 'namkeen');
    assert.deepEqual(url.searchParams.getAll('p[]'), [
      'facets.price_range.from=1',
      'facets.price_range.to=300',
    ]);
    assert.equal(url.searchParams.get('page'), '3');
    assert.deepEqual(
      new URL(flipkartSearchUrl('lamp', { minPaise: 50000, maxPaise: null })).searchParams.getAll(
        'p[]',
      ),
      ['facets.price_range.from=500', 'facets.price_range.to=Max'],
    );
  });
});

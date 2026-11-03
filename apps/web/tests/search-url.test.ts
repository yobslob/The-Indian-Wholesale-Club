import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DbError } from '@repo/db';
import { isSearchBusy } from '@repo/db/store';

import { asCame, plainSearch, readSearch, searchHref, withFilters } from '../features/search/search-url';

describe('a search that ran out of time (launch QA D-1)', () => {
  it('is told from other failures', () => {
    assert.ok(isSearchBusy(new DbError('57014', 'canceling statement due to statement timeout')));
    assert.ok(isSearchBusy(new DbError('unknown', 'TimeoutError: The operation was aborted due to timeout')));
    assert.ok(isSearchBusy(new DbError('PGRST003', 'Timed out acquiring connection from connection pool.')));
    assert.ok(isSearchBusy(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    assert.ok(!isSearchBusy(new DbError('42883', 'function does not exist')));
    assert.ok(!isSearchBusy('nope'));
  });
});

describe("a search's one address (launch QA D-2: the CDN keys by address)", () => {
  it('reads the words as the database does and drops what is unknown or malformed', () => {
    const s = readSearch({ q: '  Silk   SAREE ', type: 'clothing', category: 'Bad!', sort: 'cheapest', show: '48', utm_source: 'x' }, false);
    assert.deepEqual(s, {
      q: 'silk saree',
      delivery: false,
      type: 'clothing',
      category: null,
      state: null,
      sort: null,
      show: 48,
      retry: false,
    });
    assert.equal(readSearch({ q: 'ghee', state: 'kerala', delivery: '7-day' }, true).state, null, 'the 7-day store has no states');
  });

  it('writes its parameters in one order, without defaults', () => {
    const s = readSearch({ sort: 'new', q: 'Kurti', show: '24', state: 'punjab' }, false);
    assert.equal(searchHref('/search', s), '/search?q=kurti&state=punjab&sort=new');
    assert.equal(searchHref('/search', { ...s, retry: true }), '/search?q=kurti&state=punjab&sort=new&retry=1');
    assert.equal(searchHref('/search', plainSearch('')), '/search');
  });

  it('tells an address already in that form from one to redirect', () => {
    const own = { q: 'masala', type: 'food' };
    assert.equal(asCame('/search', own), searchHref('/search', readSearch(own, false)));
    const other = { type: 'food', q: 'Masala' };
    assert.notEqual(asCame('/search', other), searchHref('/search', readSearch(other, false)));
  });

  it('changes filters from the first page again, never keeping Try again', () => {
    const s = { ...readSearch({ q: 'saree', show: '72', retry: '1' }, false) };
    assert.equal(searchHref('/search', withFilters(s, { type: 'clothing', sort: 'price-asc' })), '/search?q=saree&type=clothing&sort=price-asc');
    assert.equal(searchHref('/search', withFilters(s, { type: 'nonsense' })), '/search?q=saree');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  browseHref,
  inStatePage,
  parseBrowseQuery,
  priceRanges,
  sizeGroups,
  sortSizes,
  sortsFor,
  toBrowseFilter,
  withFilter,
} from '../features/catalog/browse-query';

describe("See all's filters in the address (D-136)", () => {
  it('reads every filter and leaves out what is malformed', () => {
    const q = parseBrowseQuery(new URLSearchParams('state=kerala&category=Bad!&min=60&max=20&size=M&size=XL&size=M&sort=price-asc&show=48'));
    assert.deepEqual(q, { state: 'kerala', category: undefined, min: 20, max: 60, sizes: ['M', 'XL'], sort: 'price-asc', show: 48 });
    assert.equal(parseBrowseQuery({ sort: 'cheapest', show: '24' }).sort, 'low');
    assert.equal(parseBrowseQuery({ show: '24' }).show, undefined);
  });

  it('writes one address per filter set, in a fixed order', () => {
    const q = parseBrowseQuery(new URLSearchParams('size=L&sort=price-desc&state=punjab'));
    assert.equal(browseHref('clothing', q), '/clothing?state=punjab&size=L&sort=price-desc');
    assert.equal(browseHref('food', parseBrowseQuery({})), '/food');
  });

  it('opens low to high; Newest is a choice in the address (D-144)', () => {
    assert.equal(parseBrowseQuery({}).sort, 'low');
    assert.equal(browseHref('clothing', parseBrowseQuery({ sort: 'low' })), '/clothing');
    assert.equal(browseHref('clothing', parseBrowseQuery({ sort: 'new' })), '/clothing?sort=new');
    assert.equal(toBrowseFilter('food', parseBrowseQuery({}), 0, 24).sort, 'low');
    assert.deepEqual(sortsFor('clothing').map((s) => s.value), ['low', 'price-asc', 'price-desc', 'new']);
    assert.deepEqual(sortsFor('food').map((s) => s.value), ['low', 'price-desc', 'new']);
  });

  it('a new state drops the category and every change starts again at the first page', () => {
    const q = parseBrowseQuery({ state: 'kerala', category: 'sarees', show: '72' });
    assert.deepEqual(withFilter(q, { state: 'punjab' }), { ...q, state: 'punjab', category: undefined, show: undefined });
    assert.equal(withFilter(q, { sizes: ['M'] }).category, 'sarees');
  });

  it('asks the database in cents, whole dollars inclusive', () => {
    const f = toBrowseFilter('clothing', parseBrowseQuery({ min: '20', max: '30' }), 24, 24);
    assert.equal(f.minCents, 2000);
    assert.equal(f.maxCents, 3000);
    assert.equal(f.offset, 24);
  });
});

describe('sizes in wearing order', () => {
  it('letters, then numbers of one kind together, then weights, free size last', () => {
    const values = ['XL', 'Free size', '1 kg', 'S', 'W30', 'US 9', '250 g', 'M', 'US 10', 'W28', '10-12 Y', '2-3 Y', 'XXL'];
    assert.deepEqual(
      sortSizes(values.map((value) => ({ value }))).map((s) => s.value),
      ['S', 'M', 'XL', 'XXL', '2-3 Y', '10-12 Y', 'US 9', 'US 10', 'W28', 'W30', '250 g', '1 kg', 'Free size'],
    );
  });
});

describe('ready-made price ranges', () => {
  it('four ranges from the quartiles, rounded', () => {
    assert.deepEqual(
      priceRanges({ min: 1799, max: 80499, q1: 6499, q2: 8999, q3: 14299 }).map((r) => r.label),
      ['Up to $60', '$60 to $90', '$90 to $140', '$140 & above'],
    );
  });
  it('none when every price is about the same', () => {
    assert.deepEqual(priceRanges({ min: 1999, max: 2199, q1: 1999, q2: 2099, q3: 2199 }), []);
    assert.deepEqual(priceRanges(null), []);
  });
});

describe("See all's For and size groups (D-140)", () => {
  it('reads ?for= as women or men only, and keeps it in the address after the category', () => {
    const q = parseBrowseQuery(new URLSearchParams('for=women&category=kurtas'));
    assert.equal(q.who, 'women');
    assert.equal(parseBrowseQuery(new URLSearchParams('for=kids')).who, undefined);
    assert.equal(browseHref('clothing', q), '/clothing?category=kurtas&for=women');
    assert.equal(toBrowseFilter('clothing', q, 0, 24).forWho, 'women');
  });

  it('groups sizes the way people look for them, each group in wearing order', () => {
    const groups = sizeGroups(
      ['XL', 'W32', 'UK 7', '2.6', 'S', '2-3 Y', 'One size', 'L/XL', 'W28', '2.4', 'Kids 10', 'Custom'].map((value) => ({ value })),
    );
    assert.deepEqual(
      groups.map((g) => [g.label, g.sizes.map((s) => s.value)]),
      [
        ['Tops & kurtas', ['S', 'XL', 'L/XL']],
        ['Waist', ['W28', 'W32']],
        ['Footwear', ['UK 7']],
        ['Bangles', ['2.4', '2.6']],
        ["Kids' ages", ['2-3 Y', 'Kids 10']],
        ['One size', ['One size']],
        ['Other sizes', ['Custom']],
      ],
    );
  });
});

describe('the checks that replaced zod in the browser (D-157)', () => {
  it('keeps the same rules: whole numbers in range, a size of 1 – 40 letters, a known sort', () => {
    const q = parseBrowseQuery({ min: '1.5', max: '100001', size: ['  ', 'x'.repeat(41), ' L '], sort: 'new', show: '480' });
    assert.equal(q.min, undefined);
    assert.equal(q.max, undefined);
    assert.deepEqual(q.sizes, ['L']);
    assert.equal(q.sort, 'new');
    assert.equal(q.show, 480);
    assert.equal(parseBrowseQuery({ show: '481' }).show, undefined);
    assert.equal(parseBrowseQuery({ min: '' }).min, 0);
    assert.equal(parseBrowseQuery({ state: 'Kerala' }).state, undefined);
  });
});

describe("a state's own inventory (D-157)", () => {
  it("writes the state's address: its type (none for Clothing), then the filters without the state", () => {
    const q = inStatePage(parseBrowseQuery({}), 'punjab');
    assert.equal(browseHref('clothing', q), '/states/punjab');
    assert.equal(browseHref('food', { ...q, category: 'sweets' }), '/states/punjab?type=food&category=sweets');
    assert.equal(browseHref('home', withFilter(q, { sort: 'price-desc' })), '/states/punjab?type=home-and-gifts&sort=price-desc');
    // the database still reads the state
    assert.equal(toBrowseFilter('food', q, 0, 24).regionSlug, 'punjab');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pageHref, pageWindow, parsePage, parsePageSize, plainParams, rangeLabel } from '../features/admin/pager/paging';

describe("the admin pager's arithmetic (D-140, F10)", () => {
  it('says which rows a page shows out of the real total', () => {
    assert.equal(rangeLabel(1, 50, 3412), '1–50 of 3,412');
    assert.equal(rangeLabel(69, 50, 3412), '3,401–3,412 of 3,412');
    assert.equal(rangeLabel(1, 50, 0), 'None');
    assert.equal(rangeLabel(2, 25, 30), '26–30 of 30');
  });

  it('shows the first and last pages and the ones around the current page, gaps between', () => {
    assert.deepEqual(pageWindow(1, 69), [1, 2, 3, 'gap', 68, 69]);
    assert.deepEqual(pageWindow(35, 69), [1, 2, 'gap', 33, 34, 35, 36, 37, 'gap', 68, 69]);
    assert.deepEqual(pageWindow(1, 1), [1]);
    // a gap of one page shows the page instead of "…"
    assert.deepEqual(pageWindow(5, 9), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(pageWindow(6, 12), [1, 2, 3, 4, 5, 6, 7, 8, 'gap', 11, 12]);
  });

  it('reads the page and the page size from the address, else the remembered size, else 50', () => {
    assert.equal(parsePage('3'), 3);
    assert.equal(parsePage(['4', '9']), 4);
    assert.equal(parsePage('0'), 1);
    assert.equal(parsePage('abc'), 1);
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePageSize('100', '25'), 100);
    assert.equal(parsePageSize('7', '25'), 25);
    assert.equal(parsePageSize(undefined, undefined), 50);
  });

  it('keeps the filters on every page link and leaves page 1 without a page number', () => {
    assert.equal(pageHref('/admin/catalog', { status: 'live', q: 'kurta', page: '3' }, 4), '/admin/catalog?status=live&q=kurta&page=4');
    assert.equal(pageHref('/admin/catalog', { status: 'live', page: '3' }, 1), '/admin/catalog?status=live');
    assert.equal(pageHref('/admin/import/auto', { held: '2', page: '5' }, 3, 'held'), '/admin/import/auto?page=5&held=3');
    assert.deepEqual(plainParams({ a: '1', b: ['2', '3'], c: '', d: undefined }), { a: '1', b: '2' });
  });
});

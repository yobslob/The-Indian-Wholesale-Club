import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lookKey } from '../src/domain/looks';
import {
  amazonFullSize,
  isConnectionDown,
  isOwnLook,
  amazonLookImages,
  lookAction,
  lookCsvRow,
  lookCsvUndo,
  missingLooks,
  type LookListing,
} from '../src/sourcing/auto/looks';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const v = (n: number, options: Record<string, string>, item_key: string) => ({
  id: id(n),
  label: Object.values(options).join(' · '),
  options,
  item_key,
  item_url: `https://www.amazon.in/dp/${item_key}`,
  site: 'amazon.in',
});
const listing = (variants: LookListing['variants'], tagged: string[] = []): LookListing => ({
  id: id(99),
  name: 'Kurta',
  source_url: 'https://www.amazon.in/dp/AAAAAAAAA1',
  source_site: 'amazon.in',
  photos: [
    { id: id(50), storage_path: 'products/x/s/main.jpg', variant_id: null, is_primary: true },
    ...tagged.map((t, i) => ({ id: id(60 + i), storage_path: `products/x/s/${i}.jpg`, variant_id: t, is_primary: false })),
  ],
  variants,
});
const kurta = [
  v(1, { colour: 'Navy', size: 'S' }, 'AAAAAAAAA1'),
  v(2, { colour: 'Navy', size: 'M' }, 'AAAAAAAAA2'),
  v(3, { colour: 'Red', size: 'S' }, 'BBBBBBBBB1'),
  v(4, { colour: 'Red', size: 'M' }, 'BBBBBBBBB2'),
  v(5, { colour: 'Teal', size: 'M' }, 'CCCCCCCCC1'),
];
const NAVY = lookKey({ colour: 'Navy' });
const RED = lookKey({ colour: 'Red' });
const TEAL = lookKey({ colour: 'Teal' });

describe('which looks need a photo (D-194)', () => {
  it('leaves out a look tagged on any of its sizes, and puts the page’s own look first', () => {
    const missing = missingLooks(listing(kurta, [id(4)]), 'AAAAAAAAA1');
    assert.deepEqual(missing.map((m) => m.look), [NAVY, TEAL]);
    assert.equal(missing[0]!.label, 'Navy');
  });
  it('puts the page’s own look first even when it isn’t the first variant', () => {
    const missing = missingLooks(listing(kurta), 'CCCCCCCCC1');
    assert.equal(missing[0]!.look, TEAL);
  });
  it('has nothing to do for a listing with one look', () => {
    assert.deepEqual(missingLooks(listing([v(1, { size: 'S' }, 'A'), v(2, { size: 'M' }, 'B')]), 'A'), []);
  });
});

describe('where an Amazon page shows a look (D-194)', () => {
  const missing = missingLooks(listing(kurta), 'AAAAAAAAA1');
  const raw = { asin: 'AAAAAAAAA1', main: 'https://img/main.jpg', colourImages: {}, swatches: [] };
  it('takes the page’s own photo for its own look', () => {
    assert.deepEqual(amazonLookImages(raw, missing).get(NAVY), { urls: ['https://img/main.jpg'], method: 'page' });
  });
  it('takes the colour map first, whatever its spelling', () => {
    const found = amazonLookImages({ ...raw, colourImages: { red: ['https://img/red.jpg'] }, swatches: [{ asin: 'BBBBBBBBB1', image: 'https://img/swatch._SS40_.jpg' }] }, missing);
    assert.deepEqual(found.get(RED), { urls: ['https://img/red.jpg'], method: 'colour-map' });
  });
  it('takes a swatch at its own size, from any size of the colour', () => {
    const found = amazonLookImages({ ...raw, swatches: [{ asin: 'BBBBBBBBB2', image: 'https://img/71a._SX38_SY50_CR,0,0,38,50_.jpg' }] }, missing);
    assert.deepEqual(found.get(RED), { urls: ['https://img/71a.jpg'], method: 'swatch' });
  });
  it('has nothing for a look the page doesn’t show, so its item page is read', () => {
    assert.equal(amazonLookImages(raw, missing).has(TEAL), false);
  });
  it('removes the size token and nothing else', () => {
    assert.equal(amazonFullSize('https://m.media-amazon.com/images/I/71abc._AC_SR38,50_.jpg'), 'https://m.media-amazon.com/images/I/71abc.jpg');
    assert.equal(amazonFullSize('https://m.media-amazon.com/images/I/71abc.jpg'), 'https://m.media-amazon.com/images/I/71abc.jpg');
  });
});

describe('what a picture is to the listing (D-194)', () => {
  const picture = (fill: number, width = 1000, height = 1200) => ({ width, height, pixels: new Uint8Array(256 * 256 * 3).fill(fill) });
  it('tags a shared photo it matches, even a small picture, with no upload', () => {
    assert.deepEqual(lookAction(picture(10, 500, 600), [{ id: 'a', print: picture(10), look: null }]), { action: 'tag', photo: 'a' });
  });
  it('skips a picture another look already has', () => {
    assert.deepEqual(lookAction(picture(10), [{ id: 'a', print: picture(10), look: 'colour=red' }]), { action: 'same-as-other' });
  });
  it('prefers the shared photo when both match', () => {
    const stored = [{ id: 'a', print: picture(10), look: 'colour=red' }, { id: 'b', print: picture(10), look: null }];
    assert.deepEqual(lookAction(picture(10), stored), { action: 'tag', photo: 'b' });
  });
  it('stores a new picture only when it is big enough', () => {
    assert.deepEqual(lookAction(picture(200), [{ id: 'a', print: picture(10), look: null }]), { action: 'add' });
    assert.deepEqual(lookAction(picture(200, 599, 900), []), { action: 'too-small' });
    assert.deepEqual(lookAction(picture(200, 600, 900), []), { action: 'add' });
  });
  it('compares against no stored print as new', () => {
    assert.deepEqual(lookAction(picture(200), [{ id: 'a', print: null, look: null }]), { action: 'add' });
  });
});

describe('the page’s own look (D-194, dry runs 2026-11-09)', () => {
  const picture = (fill: number, width = 1000, height = 1200) => ({ width, height, pixels: new Uint8Array(256 * 256 * 3).fill(fill) });
  it('tags the matching photo when there is one', () => {
    const stored = [{ id: 'main', print: picture(10), look: null }, { id: 'b', print: picture(90), look: null }];
    assert.deepEqual(lookAction(picture(90), stored, { mainId: 'main' }), { action: 'tag', photo: 'b' });
  });
  it('tags the main photo when the photos were made again and match nothing, and never stores one', () => {
    assert.deepEqual(lookAction(picture(200), [{ id: 'main', print: picture(10), look: null }], { mainId: 'main' }), { action: 'tag', photo: 'main' });
    assert.deepEqual(lookAction(picture(200, 300, 300), [{ id: 'main', print: picture(10), look: null }], { mainId: 'main' }), { action: 'tag', photo: 'main' });
  });
  it('leaves it when the main photo is already another look’s', () => {
    assert.deepEqual(lookAction(picture(200), [{ id: 'main', print: picture(10), look: 'colour=red' }], { mainId: 'main' }), { action: 'own-look' });
  });
});

describe('which look is the page’s own (D-194, clothing dry run 2026-11-09)', () => {
  const [navy, red] = missingLooks(listing(kurta), null);
  it('is the look whose picture is the page’s own, even when the address names another item', () => {
    assert.equal(isOwnLook(red!, 'page', 'https://www.amazon.in/dp/PARENTASIN', 'PARENTASIN'), true);
  });
  it('is the look of the address’s item', () => {
    assert.equal(isOwnLook(navy!, 'colour-map', 'https://www.amazon.in/dp/AAAAAAAAA1', 'AAAAAAAAA1'), true);
  });
  it('is no other look', () => {
    assert.equal(isOwnLook(red!, 'colour-map', 'https://www.amazon.in/dp/AAAAAAAAA1', 'AAAAAAAAA1'), false);
    assert.equal(isOwnLook(red!, null, 'https://www.amazon.in/dp/AAAAAAAAA1', null), false);
  });
});

describe('a lost connection, told from a failed page (D-194, food run 2026-11-10)', () => {
  it('knows the machine went offline', () => {
    assert.equal(isConnectionDown('page.goto: net::ERR_FAILED at https://www.amazon.in/dp/B013QO7YAA'), true);
    assert.equal(isConnectionDown('fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND ttobhpcidixxdteczccv.supabase.co)'), true);
    assert.equal(isConnectionDown('worker_look_photo_plan: AggregateError:'), true);
  });
  it('leaves a slow page and the database’s own answers alone', () => {
    assert.equal(isConnectionDown('page.goto: Timeout 35000ms exceeded.'), false);
    assert.equal(isConnectionDown('worker_look_photos_add: look_has_enough_photos'), false);
  });
});

describe('the run’s CSV (D-194)', () => {
  it('gives --undo what was added and tagged, and nothing else', () => {
    const csv = [
      'listing,look,action,method,media_id,path,bytes',
      lookCsvRow({ listing: 'l1', look: 'colour=red, dark', action: 'added', method: 'swatch', mediaId: 'm1', path: 'p', bytes: 9 }),
      lookCsvRow({ listing: 'l2', look: 'colour=navy', action: 'tagged', method: 'page', mediaId: 'm2' }),
      lookCsvRow({ listing: 'l3', look: 'colour=teal', action: 'no-image' }),
      lookCsvRow({ listing: 'l4', look: 'colour=teal', action: 'would-tag', mediaId: 'm9' }),
    ].join('\n');
    assert.deepEqual(lookCsvUndo(csv), { added: ['m1'], tagged: [{ listing: 'l2', media: 'm2' }] });
  });
});

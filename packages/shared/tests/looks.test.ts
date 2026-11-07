import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { initialLook, lookKey, lookPhoto, looksOf, photosForLook, withLookPhotos } from '../src/domain/looks';

const v = (id: string, options: Record<string, string>, available = 2) => ({ id, options, available });
const m = (storage_path: string, variant_id: string | null = null) => ({ storage_path, variant_id });
const paths = (list: { storage_path: string }[]) => list.map((x) => x.storage_path);

const kurta = [
  v('n-s', { colour: 'Navy', size: 'S' }),
  v('n-m', { colour: 'Navy', size: 'M' }),
  v('r-s', { colour: 'Maroon', size: 'S' }),
  v('r-m', { colour: 'Maroon', size: 'M' }),
];
const NAVY = lookKey({ colour: 'Navy' });
const MAROON = lookKey({ colour: 'Maroon' });

describe('a look is a variant without its size (D-194)', () => {
  it('gives every size of a colour one key, and no key to a size alone', () => {
    assert.equal(lookKey({ colour: 'Navy', size: 'S' }), lookKey({ size: 'XL', colour: 'Navy' }));
    assert.equal(lookKey({ size: 'S' }), '');
    assert.equal(lookKey({}), '');
    assert.equal(lookKey(null), '');
  });
  it('reads different spellings of a value as one look', () => {
    assert.equal(lookKey({ colour: 'navy' }), lookKey({ colour: ' Navy ' }));
  });
  it('does not depend on the order of the keys', () => {
    assert.equal(lookKey({ pack: 'Single', flavour: 'Mango' }), lookKey({ flavour: 'Mango', pack: 'Single' }));
  });
  it('lists looks once each, in variant order', () => {
    assert.deepEqual(looksOf(kurta), [NAVY, MAROON]);
    assert.deepEqual(looksOf([v('a', { size: 'S' }), v('b', { size: 'M' })]), ['']);
  });
});

describe('the gallery rule (D-194)', () => {
  it('shows the own photos of a look, then the shared ones, without photos of other looks', () => {
    const media = [m('shared-1'), m('shared-2'), m('navy', 'n-s'), m('maroon', 'r-m')];
    assert.deepEqual(paths(photosForLook(media, kurta, MAROON)), ['maroon', 'shared-1', 'shared-2']);
    assert.deepEqual(paths(photosForLook(media, kurta, NAVY)), ['navy', 'shared-1', 'shared-2']);
  });
  it('counts a photo tagged to another size of the colour as belonging to that colour', () => {
    const media = [m('shared'), m('navy', 'n-m')];
    assert.equal(lookPhoto(lookKey(kurta[0]!.options), media, kurta), 'navy');
    assert.deepEqual(paths(photosForLook(media, kurta, NAVY)), ['navy', 'shared']);
  });
  it('leaves a look with no photo of its own exactly as today', () => {
    const media = [m('shared-1'), m('navy', 'n-s'), m('shared-2')];
    assert.equal(photosForLook(media, kurta, MAROON), media);
  });
  it('leaves a listing with untagged photos only exactly as today', () => {
    const media = [m('a'), m('b')];
    assert.equal(photosForLook(media, kurta, NAVY), media);
    assert.equal(photosForLook(media, kurta, null), media);
  });
  it('leaves a listing with one look exactly as today, tags or not', () => {
    const sizes = [v('s', { size: 'S' }), v('m', { size: 'M' })];
    const media = [m('b', 's'), m('a')];
    assert.equal(photosForLook(media, sizes, ''), media);
    assert.equal(lookPhoto('', media, sizes), null);
  });
  it('treats a photo tagged to a variant no longer on sale as shared, never dropping it', () => {
    const media = [m('old', 'gone'), m('navy', 'n-s'), m('maroon', 'r-s')];
    assert.deepEqual(paths(photosForLook(media, kurta, NAVY)), ['navy', 'old']);
  });
  it('gives a pack-only food listing one look per pack', () => {
    const packs = [v('one', { pack: 'Single' }), v('fam', { pack: 'Family pack' })];
    const media = [m('single', 'one'), m('family', 'fam')];
    assert.deepEqual(paths(photosForLook(media, packs, lookKey({ pack: 'Family pack' }))), ['family']);
  });
});

describe('the look a page opens on (D-194)', () => {
  it('is the look of the main photo when that look is in stock', () => {
    assert.equal(initialLook(kurta, [m('maroon', 'r-s'), m('navy', 'n-s')]), MAROON);
  });
  it('is none when the main photo is shared, so the page opens as it did', () => {
    assert.equal(initialLook(kurta, [m('shared'), m('maroon', 'r-s')]), null);
    assert.equal(initialLook(kurta, []), null);
  });
  it('is none when the look of the main photo is sold out or gone', () => {
    const out = [v('n', { colour: 'Navy' }), v('r', { colour: 'Maroon' }, 0)];
    assert.equal(initialLook(out, [m('maroon', 'r')]), null);
    assert.equal(initialLook(kurta, [m('old', 'gone')]), null);
  });
  it('is none for a listing with one look', () => {
    assert.equal(initialLook([v('s', { size: 'S' }), v('m', { size: 'M' })], [m('a', 's')]), null);
  });
});

describe('the options of a card carry the photo of their look (D-194)', () => {
  it('gives every size of the colour its photo, and null where the look has none', () => {
    const out = withLookPhotos(kurta, [m('navy', 'n-s')]);
    assert.deepEqual(out.map((o) => o.image_path), ['navy', 'navy', null, null]);
  });
  it('gives nothing to a listing with one look', () => {
    const out = withLookPhotos([v('s', { size: 'S' }), v('m', { size: 'M' })], [m('a', 's')]);
    assert.deepEqual(out.map((o) => o.image_path), [null, null]);
  });
});

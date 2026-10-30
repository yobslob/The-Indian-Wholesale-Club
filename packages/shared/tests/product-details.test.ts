import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detailRows, photoNote, productPath, regionSegment } from '../src/domain';

const kurta = {
  product_type: 'clothing' as const,
  attributes: { fibre_content: 'Cotton', care: 'Hand wash cold' },
  region_name: 'Kerala',
};

describe('detailRows (D-100)', () => {
  it('always says where the piece is from', () => {
    const rows = detailRows(kurta, photoNote([]));
    assert.deepEqual(rows.find(([label]) => label === 'Made in'), ['Made in', 'India, from Kerala']);
    assert.equal(rows.find(([label]) => label === 'Photos'), undefined);
  });

  it('says the model photos are AI-generated when any photo is, and that the close-up is real when there is one', () => {
    const both = detailRows(kurta, photoNote([{ is_ai: true }, { is_ai: false }]));
    assert.match(both.find(([label]) => label === 'Photos')?.[1] ?? '', /AI-generated.*close-up is a real photo/);
    const aiOnly = detailRows(kurta, photoNote([{ is_ai: true }]));
    assert.doesNotMatch(aiOnly.find(([label]) => label === 'Photos')?.[1] ?? '', /close-up/);
  });

  it('keeps care before the origin and drops invalid attributes (D-003)', () => {
    const rows = detailRows(kurta, photoNote([]));
    assert.deepEqual(rows.map(([label]) => label), ['Fabric', 'Care', 'Made in']);
    assert.deepEqual(detailRows({ ...kurta, attributes: { secret: 1 } }, photoNote([])).map(([l]) => l), ['Made in']);
  });
});

describe('an all-India piece (D-121)', () => {
  it('says Made in India and names no state; its page is /states/india/<slug>', () => {
    const rows = detailRows(
      { product_type: 'home', attributes: { material: 'Cane' }, region_name: null },
      { ai: false, real: true },
    );
    assert.deepEqual(rows.at(-1), ['Made in', 'India']);
    assert.equal(productPath(null, 'cane-basket'), '/states/india/cane-basket');
    assert.equal(productPath('kerala', 'kasavu-saree'), '/states/kerala/kasavu-saree');
    assert.equal(regionSegment(undefined), 'india');
  });
});

describe('a piece made outside India (D-171)', () => {
  it('has no "Made in" row: its page says only "Imported"', () => {
    const rows = detailRows({ ...kurta, region_name: null, made_in_india: false }, photoNote([]));
    assert.deepEqual(rows.map(([label]) => label), ['Fabric', 'Care']);
    // a listing read before migration 20261105100000 (no field) is still made in India
    assert.deepEqual(detailRows({ ...kurta, made_in_india: undefined }, photoNote([])).at(-1), ['Made in', 'India, from Kerala']);
  });
});

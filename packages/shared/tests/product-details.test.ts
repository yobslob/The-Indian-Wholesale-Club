import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detailRows, photoNote } from '../src/domain';

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

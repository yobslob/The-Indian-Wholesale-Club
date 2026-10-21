import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { slimCards } from '../features/catalog/slim-cards';

const option = (id: string, available: number) => ({ id, label: id, options: { size: id }, price_cents: 100, available });
const card = (slug: string, options: ReturnType<typeof option>[]) => ({ id: slug, slug, name: slug, price_cents: 100, options });

describe('slimCards (D-145)', () => {
  it('keeps a single option and leaves only the count of several, wherever the card sits', () => {
    const data = { rows: [{ products: [card('one', [option('a', 2)]), card('two', [option('s', 1), option('m', 0)])] }] };
    const [one, two] = slimCards(data).rows[0]!.products;
    assert.equal(one!.options.length, 1);
    assert.deepEqual({ ...two }, { ...card('two', []), options: null, choices: 2, sold_out: false });
  });

  it('says when every option is sold out', () => {
    assert.equal((slimCards(card('gone', [option('s', 0), option('m', 0)])) as { sold_out?: boolean }).sold_out, true);
  });

  it("leaves a variant's own options (a record) alone", () => {
    const data = { product: { slug: 'p', price_cents: 100, variants: [{ id: 'v', options: { size: 'M' }, price_cents: 100 }] } };
    assert.deepEqual(slimCards(data), data);
  });
});

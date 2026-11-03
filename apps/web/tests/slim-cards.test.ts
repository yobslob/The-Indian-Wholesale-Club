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

  it('keeps the price its options say: "From" the lowest in stock when they differ (launch QA B-1)', () => {
    const priced = (id: string, price_cents: number, available: number) => ({ ...option(id, available), price_cents });
    const poshak = slimCards({ ...card('poshak', [priced('red', 1731, 2), priced('blue', 1630, 1), priced('pink', 1499, 0)]), price_cents: 1499 });
    assert.equal(poshak.price_cents, 1630);
    assert.equal((poshak as { price_varies?: boolean }).price_varies, true);
    const same = slimCards({ ...card('frock', [priced('s', 2273, 1), priced('m', 2273, 1), priced('l', 1999, 0)]), price_cents: 1999 });
    assert.equal(same.price_cents, 2273);
    assert.equal('price_varies' in same, false);
  });

  it("leaves a variant's own options (a record) alone", () => {
    const data = { product: { slug: 'p', price_cents: 100, variants: [{ id: 'v', options: { size: 'M' }, price_cents: 100 }] } };
    assert.deepEqual(slimCards(data), data);
  });
});

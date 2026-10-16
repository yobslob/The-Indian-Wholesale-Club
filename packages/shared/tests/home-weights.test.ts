/**
 * D-134: home & gifts are priced on the weight their own page states, the packed weight first, else the piece plus
 * its packing; a reading that cannot be right for its box is marked for the hub instead of becoming a price.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { homeVariants } from '../src/sourcing/auto';
import { boxVolume, homePacking, homeWeight } from '../src/sourcing/estimate';

const page = (title: string, specs: [string, string][]) => ({ title, specs });

describe('reading a home piece’s weight from its page (D-134)', () => {
  it('the packed weight wins: Package Dimensions "…; 640 g"', () => {
    const w = homeWeight(
      page('Brass Kerala Diya Samai 11 inch', [
        ['Item Weight', '500 Grams'],
        ['Package Dimensions', '30 x 20 x 10 cm; 640 g'],
      ]),
    );
    assert.equal(w.grams, 640);
    assert.equal(w.source, 'shop');
    assert.equal(w.sizeG, 1200); // 6 L box ÷ 5,000: kept for Q-36, not priced
  });
  it('the piece alone gets its packing by what it is made of', () => {
    const brass = homeWeight(
      page('Brass Peacock Diya', [
        ['Material', 'Brass'],
        ['Item Weight', '1.2 Kilograms'],
      ]),
    );
    assert.equal(brass.grams, 1405); // 1,200 g + box and wrapping 204 g
    assert.equal(brass.source, 'packed');
    const glass = homeWeight(
      page('Hand painted tea light holder', [
        ['Material', 'Glass'],
        ['Item Weight', '300 g'],
      ]),
    );
    assert.equal(glass.grams, 495); // fragile: 120 g + 25%
    assert.match(glass.look ?? '', /fragile/);
    assert.equal(
      homeWeight(page('Warli Art Stretched Canvas Painting', [['Item Weight', '700 g']])).grams,
      885,
    );
    assert.equal(
      homeWeight(page('Crewel Embroidered Cushion Cover 14 x 14 Inch', [['Item Weight', '150 g']]))
        .grams,
      180,
    );
  });
  it('reads Product Dimensions with a weight, and the new dropdown rows', () => {
    const w = homeWeight(
      page('Kathakali Face Stand', [['Product Dimensions', '10L x 8W x 25H Centimeters; 450 g']]),
    );
    assert.equal(w.grams, 565); // 450 g + box and wrapping 114 g
  });
  it('a package lighter than its piece is doubted, and the piece is used', () => {
    const w = homeWeight(
      page('Brass Urli', [
        ['Item Weight', '900 g'],
        ['Item Package Weight', '200 g'],
      ]),
    );
    assert.equal(w.source, 'packed');
    assert.match(w.look ?? '', /lighter than the piece/);
  });
  it('a weight that cannot be right for its size is not used', () => {
    const w = homeWeight(
      page('Brass Kerala Samai', [
        ['Item Weight', '1 g'],
        ['Product Dimensions', '30 x 20 x 10 cm'],
      ]),
    );
    assert.equal(w.grams, null);
    assert.match(w.look ?? '', /cannot be right/);
  });
  it('no weight: none, for the hub', () => {
    assert.equal(homeWeight(page('Bastar Dhokra Art Musician', [['Brand', 'Bastar']])).grams, null);
  });
  it('box sizes in cm, mm and inches', () => {
    assert.equal(boxVolume('30 x 20 x 10 cm; 640 g'), 6000);
    assert.equal(boxVolume('300 x 200 x 100 Millimeters'), 6000);
    assert.equal(Math.round(boxVolume('10 x 5 x 2 inches')!), 1639);
    assert.equal(boxVolume('Medium'), null);
  });
  it('what it is made of: its Material row before its name', () => {
    assert.equal(homePacking('Wooden ladle set', [['Material', 'Ceramic']]).packing, 'fragile');
    assert.equal(homePacking('Terracotta pots').packing, 'fragile');
    assert.equal(homePacking('Pichwai art wall plate').packing, 'flat');
    assert.equal(homePacking('Jaipuri cotton bedsheet').packing, 'soft');
    assert.equal(homePacking('Rosewood elephant').packing, 'sturdy');
  });
});

describe('the runner weighs a new home listing from its page (D-134)', () => {
  const v = (key: string, label: string) => ({
    item_key: key,
    item_url: `https://www.amazon.in/dp/${key}`,
    label,
    options: { size: label },
    price_paise: 50000,
    mrp_paise: null,
    in_stock: true,
    delivery_days: 2,
    weight_g: 500,
    weight_source: 'shop' as const,
    weight_note: 'Item Weight: 500 g',
  });
  it('only the page’s own item takes the page’s weight; the other sizes read their own pages later', () => {
    const [small, large] = homeVariants([v('B0SMALL001', 'Small'), v('B0LARGE001', 'Large')], {
      url: 'https://www.amazon.in/dp/B0SMALL001',
      title: 'Brass diya',
      specs: [
        ['Item Weight', '500 g'],
        ['Material', 'Brass'],
      ],
    });
    assert.deepEqual([small?.weight_g, small?.weight_source], [620, 'packed']);
    assert.equal(large?.weight_g, null);
    assert.equal(large?.weight_source, undefined);
  });
});

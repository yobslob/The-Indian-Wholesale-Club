/**
 * D-135: liquids are not sent (pickles are, even in oil): a liquid listing is archived and shown as coming soon.
 * Names from the real food and home listings where there are some.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { liquidReason } from '../src/sourcing';

const food = (name: string, labels: string[] = [], specs?: [string, string][]) =>
  liquidReason({ type: 'food', name, labels, specs });
const home = (name: string, specs?: [string, string][]) =>
  liquidReason({ type: 'home', name, specs });

describe('what is a liquid (D-135)', () => {
  it('drinks, syrups, oils, sauces and anything in millilitres', () => {
    assert.ok(food('The Wellness Shop Himalayan Sea Buckthorn Juice'));
    assert.ok(food('Baidyanath Ayurvedant Thandai Sharbat'));
    assert.ok(food('Dobra Pop Goli Banta Soda - Kokum Jeera'));
    assert.ok(food('Cold pressed mustard oil 1 L'));
    assert.ok(food('Kairi panha', ['250 ml']));
    assert.ok(food('Amul Pure Ghee', ['1 L']), 'ghee sold by the litre');
    assert.match(food('Rose syrup') ?? '', /syrup/);
  });
  it('the page’s own word wins', () => {
    assert.ok(food('Organic honey', [], [['Item Form', 'Liquid']]));
    assert.equal(food('Instant sharbat premix', [], [['Item Form', 'Powder']]), null);
  });
  it('never pickles, pastes, powders, sweets or snacks', () => {
    assert.equal(food('Mango pickle in mustard oil 500 g'), null);
    assert.equal(
      food('Ker Sangri Pickle 325g In Fresh Rajasthani Homemade Achar Mustard Oil'),
      null,
    );
    assert.equal(food('Garlic chutney', ['200 ml']), null);
    assert.equal(food('Ginger garlic paste'), null);
    assert.equal(food('Rasna instant drink mix'), null);
    assert.equal(food('Amla juice candy'), null);
    assert.equal(food('Milk peda 250 g'), null);
    assert.equal(food('Pure cow ghee 500 g'), null, 'ghee sold by weight');
    assert.equal(food('Banana chips in coconut oil'), null);
  });
  it('home: attars, perfumes, rose water and body oils; never a vessel by its size', () => {
    assert.ok(home('Kannauj rose attar 10 ml'));
    assert.ok(home('Pure rose water for skin'));
    assert.ok(home('Ayurvedic hair oil'));
    assert.ok(home('Sandalwood room spray', [['Item Form', 'Liquid']]));
    assert.equal(home('Brass kalash lota 500 ml'), null);
    assert.equal(home('Brass oil lamp diya'), null);
    assert.equal(home('Aroma oil diffuser'), null);
    assert.equal(home('Kerala Kathakali Face Stand'), null);
  });
  it('clothing is never judged', () => {
    assert.equal(liquidReason({ type: 'clothing', name: 'Oil painted silk saree' }), null);
  });
});

describe('how it is made is not what it is (D-135)', () => {
  it('“no palm oil”, “oil free”, “in sunflower oil”, a yak milk chew', () => {
    assert.equal(food('VS Mani Khara Boondi, No Palm Oil'), null);
    assert.equal(
      food('Homepick Amba Haldi 300g - Pickled Turmeric and Mango Ginger Oil free'),
      null,
    );
    assert.equal(
      food('Urban Platter Chilli Garlic Crisp, 190g (Crunchy Chilli and Garlic in Sunflower Oil)'),
      null,
    );
    assert.equal(food('Chewers Mountain Dog Chew, Natural Himalayan Yak Milk Churpi'), null);
    assert.ok(food('Coco Soul Virgin Coconut Oil'));
  });
});

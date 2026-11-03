import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { displayOption, displayTitle } from '../src/domain';
import { cleanTitle, fixSpelling } from '../src/sourcing';

describe('display-time title case (launch QA B-9)', () => {
  it('title-cases an all lower-case title, small words inside it staying small', () => {
    assert.equal(displayTitle('rajasthani rajputi poshak'), 'Rajasthani Rajputi Poshak');
    assert.equal(displayTitle('the kurta with dupatta for women'), 'The Kurta with Dupatta for Women');
    assert.equal(displayTitle('off-white set of 2'), 'Off-White Set of 2');
    assert.equal(displayTitle("haldiram's aloo bhujia"), "Haldiram's Aloo Bhujia");
  });

  it('keeps units after a number, numbers with units, and all-caps words', () => {
    assert.equal(displayTitle('kaju katli 10 g'), 'Kaju Katli 10 g');
    assert.equal(displayTitle('basmati rice 5 kg pack'), 'Basmati Rice 5 kg Pack');
    assert.equal(displayTitle('rose water 500ml bottle'), 'Rose Water 500ml Bottle');
    assert.equal(displayTitle('mustard oil 1 l'), 'Mustard Oil 1 l');
    assert.equal(displayTitle('IWC cotton kurta (blue)'), 'IWC Cotton Kurta (Blue)');
    assert.equal(displayTitle('saree 5.5 m'), 'Saree 5.5 m');
    assert.equal(displayTitle('kurta xl'), 'Kurta XL');
  });

  it('leaves a title the shop capitalised exactly as it is', () => {
    assert.equal(displayTitle('Kasavu saree with gold border'), 'Kasavu saree with gold border');
    assert.equal(displayTitle('Haldiram’s Bhujia 400g'), 'Haldiram’s Bhujia 400g');
    assert.equal(displayTitle('M'), 'M');
    assert.equal(displayTitle(''), '');
  });

  it('reads option labels part by part: sizes in their one spelling, the rest title-cased', () => {
    assert.equal(displayOption('blue'), 'Blue');
    assert.equal(displayOption('blue · 0-6 M'), 'Blue · 0–6 months');
    assert.equal(displayOption('Maroon · XL'), 'Maroon · XL');
    assert.equal(displayOption('xl'), 'XL');
    assert.equal(displayOption('200 g'), '200 g');
  });
});

describe("the importer's spelling list (launch QA B-9)", () => {
  it('fixes whole words in the case the shop wrote them', () => {
    assert.equal(fixSpelling('Cotten Blend Kurta'), 'Cotton Blend Kurta');
    assert.equal(fixSpelling('COTTEN SAREE'), 'COTTON SAREE');
    assert.equal(fixSpelling('pure georgete embroided dupatta'), 'pure georgette embroidered dupatta');
    assert.equal(fixSpelling('Cottenwear'), 'Cottenwear');
  });

  it('runs in the clean-up step that names a new import, food included', () => {
    assert.equal(cleanTitle('Cotten Blend Kurta for Women', { productType: 'clothing' }), 'Cotton Blend Kurta for Women');
    assert.equal(cleanTitle('Premuim Kaju Katli 250 g', { productType: 'food' }), 'Premium Kaju Katli 250 g');
  });
});

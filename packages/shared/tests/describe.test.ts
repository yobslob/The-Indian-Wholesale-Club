/**
 * D-178: the description redo's rules. The shop's sentences about money, links, selling and its photos never reach the
 * model; a rewrite passes only with no price, link, shop, emoji or health claim, every number from the listing and
 * none new, its measures kept, no invented material or name, the store's format and voice, and prose of its own.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  avoidWords,
  checkRewrite,
  cleanShopText,
  describePrompt,
  numbers,
  readDescribeAnswer,
  type DescribeSource,
} from '../src/sourcing/describe';

const saree: DescribeSource = {
  type: 'clothing',
  name: 'Paisley Bagru Saree',
  category: 'Sarees & Drapes',
  wears: 'women',
  attributes: { fibre_content: 'Pure Cotton', care: 'Hand wash' },
  summary: 'Purple and magenta Bagru saree.',
  description:
    'Purple and Magenta Bagru sarees with a printed border 😍. MRP Rs. 1,999, 40% off today!\n' +
    'The blouse worn by the model might be for modelling purpose only.\n' +
    'Length: 5.5 metres plus 0.8 metre blouse piece\nBuy now on Myntra: https://myntra.com/x',
  shop_title: 'Anouk Women Paisley Bagru Saree',
  shop: 'Myntra',
  made_in: 'India',
};

const good = {
  summary: 'A purple and magenta Bagru saree with paisley prints all over.',
  description:
    'Deep purple meets magenta in this Bagru print, finished with a printed border. It drapes softly and comes ' +
    'with its own unstitched blouse piece.\n\n• Length: 5.5 metres, with a 0.8 metre blouse piece\n• Border: Printed',
};

describe('the shop text the model reads', () => {
  it('drops money, links, the model photo note and emojis, keeping the facts', () => {
    const text = cleanShopText(saree.description);
    assert.doesNotMatch(text, /1,999|40%|myntra|model|😍/i);
    assert.match(text, /Purple and Magenta Bagru sarees with a printed border\./);
    assert.match(text, /Length: 5\.5 metres plus 0\.8 metre/);
  });
  it('names what must never be written: the shop and, for clothing, the brand', () => {
    assert.deepEqual(avoidWords(saree), ['Myntra', 'Anouk']);
    assert.deepEqual(
      avoidWords({
        ...saree,
        type: 'food',
        shop_title: 'MTR Sambar',
        name: 'MTR Sambar',
        shop: null,
      }),
      [],
    );
    assert.deepEqual(
      avoidWords({ ...saree, name: 'KALINI Women Printed Kurta', shop_title: null, shop: null }),
      ['KALINI'],
    );
  });
  it('asks with the shown rows, the names to avoid and, on a retry, why', () => {
    const p = describePrompt(saree, ['a number not in the listing: 200']);
    assert.match(p, /Shown on the page: Fabric: Pure Cotton; Care: Hand wash/);
    assert.match(p, /Never write these names: Myntra, Anouk/);
    assert.match(p, /not accepted: a number not in the listing: 200/);
    assert.doesNotMatch(p, /1,999/);
  });
  it('reads numbers without thousands commas or trailing zeros', () => {
    assert.deepEqual(numbers('1,999 and 2.50 and 05'), ['1999', '2.5', '5']);
  });
});

describe('the checks', () => {
  it('pass a fresh rewrite that keeps the facts', () => {
    const r = checkRewrite(saree, good);
    assert.deepEqual(r.failures, []);
    assert.ok(r.pass && r.overlap < 0.2);
  });
  it('refuse money, links, shops and emojis outright', () => {
    const r = checkRewrite(saree, {
      ...good,
      summary: 'Now Rs. 999 on Myntra, see www.shop.in 😍 today.',
    });
    assert.equal(r.pass, false);
    assert.deepEqual(
      r.hard.map((h) => h.split(':')[0]),
      [
        'talks of money',
        'a link, email or phone',
        'an emoji or symbol',
        'names a shop',
        'names the brand or shop',
      ],
    );
  });
  it('refuse a number the listing does not have, and a measure left out', () => {
    const r = checkRewrite(saree, {
      ...good,
      description: good.description.replace('0.8 metre', '1 metre'),
    });
    assert.ok(r.failures.some((f) => f.startsWith('a number not in the listing: 1')));
    assert.ok(r.failures.some((f) => f.startsWith('a fact left out: 0.8 metre')));
  });
  it('refuse an invented material, place or claim', () => {
    const r = checkRewrite(saree, {
      ...good,
      summary: 'A handwoven silk saree from Jaipur with paisley prints all over.',
    });
    assert.ok(r.failures.some((f) => /not stated in the listing: handwoven, silk/.test(f)));
    assert.ok(r.failures.some((f) => /a name not in the listing: Jaipur/.test(f)));
  });
  it('refuse ingredients or a fact line the listing does not state', () => {
    const sweet: DescribeSource = {
      ...saree,
      type: 'food',
      name: 'Besan Pinni',
      category: 'Sweets',
      attributes: {},
      summary: null,
      description: 'Sweets made with the finest ingredients. Package contents: 900 g.',
      shop_title: null,
      shop: null,
    };
    const r = checkRewrite(sweet, {
      summary: 'Besan pinni, a sweet to share, in a 900 g pack.',
      description:
        'Soft rounds of besan made for sharing.\n\n• Ingredients: Besan, ghee, saffron\n• Net weight: 900 g\n• Pack: Resealable bag',
    });
    assert.ok(r.failures.some((f) => /not stated in the listing: ghee, saffron/.test(f)));
    assert.ok(
      r.failures.some((f) => /a fact line the listing does not state: "Ingredients/.test(f)),
    );
    assert.ok(!r.failures.some((f) => /the ingredients left out/.test(f)));
  });
  it('allow India only for a piece made in India', () => {
    const indian = {
      ...good,
      summary: 'An Indian Bagru saree in purple and magenta paisley prints.',
    };
    assert.ok(checkRewrite(saree, indian).pass);
    assert.ok(!checkRewrite({ ...saree, made_in: 'China' }, indian).pass);
  });
  it('refuse ad words, health claims and a broken fact line', () => {
    const r = checkRewrite(saree, {
      ...good,
      description: `${good.description} It is perfect and boosts immunity!\n• Size: Length: 5.5 metres`,
    });
    assert.ok(r.failures.some((f) => f.startsWith('ad words')));
    assert.ok(r.failures.some((f) => f.startsWith('a health claim')));
    assert.ok(r.failures.some((f) => f.startsWith('a fact with a second colon')));
  });
  it('refuse prose copied from the shop', () => {
    const r = checkRewrite(saree, {
      ...good,
      summary: 'Purple and Magenta Bagru sarees with a printed border, for you.',
    });
    assert.ok(r.failures.some((f) => f.startsWith('the summary or paragraph copies the shop')));
  });
});

describe("the model's answer", () => {
  it('becomes a paragraph and fact lines, empty and praise-only lines and repeats dropped, ad words made plain', () => {
    const words = readDescribeAnswer(
      JSON.stringify({
        summary: 'a soft cotton kurta',
        intro: 'It is perfect for summer days, making it perfect for special occasions.',
        facts: [
          { label: 'fabric', value: 'cotton.' },
          { label: 'Width', value: 'Not specified' },
          { label: 'Aesthetic', value: 'Elegant and unique' },
          { label: 'Look', value: 'Lovely' },
          { label: 'Fabric', value: 'Cotton again' },
        ],
      }),
    );
    assert.deepEqual(words, {
      summary: 'A soft cotton kurta.',
      description: 'It is good for summer days.\n\n• Fabric: Cotton',
    });
    assert.equal(readDescribeAnswer('not json'), null);
  });
});

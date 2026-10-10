import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkPhoto, LANGUAGES, languageForRegion, pieceFormSchema, switchLanguages, t, toSubmitDetails } from '../src/vendor';

describe('vendor words (D-102)', () => {
  const english = LANGUAGES.en.messages;
  for (const [code, { messages }] of Object.entries(LANGUAGES)) {
    it(`${code}: every word is there and keeps its {placeholders}`, () => {
      for (const [key, text] of Object.entries(english)) {
        const translated = messages[key as keyof typeof english];
        assert.ok(translated && translated.trim().length > 0, `${code}.${key} is empty`);
        for (const slot of text.match(/\{[a-z]+\}/g) ?? []) assert.ok(translated.includes(slot), `${code}.${key} lost ${slot}`);
      }
    });
  }
  it('fills placeholders and falls back to English for an unknown language', () => {
    assert.equal(t('en', 'step_of', { n: 2, total: 4 }), 'Step 2 of 4');
    assert.equal(t('xx', 'next'), 'Next');
  });
  it('picks the region language, Hindi where none fits, and offers few languages', () => {
    assert.equal(languageForRegion(['Malayalam']), 'ml');
    assert.equal(languageForRegion(['Khasi']), 'hi');
    assert.deepEqual(switchLanguages('en', ['Tamil']), ['en', 'hi', 'ta']);
  });
});

describe('the piece form (D-103)', () => {
  it('turns rupees into integer paise and keeps sizes', () => {
    const form = pieceFormSchema.parse({
      category_id: '00000000-0000-4000-8000-000000000001', wears: 'women', price_rupees: '1200', sizes: [{ label: 'M', qty: 2 }],
    });
    const details = toSubmitDetails(form);
    assert.equal(details.shop_price_paise, 120000);
    assert.deepEqual(details.variants, [{ label: 'M', qty: 2 }]);
  });
  it('refuses a piece with no sizes or no price', () => {
    assert.equal(pieceFormSchema.safeParse({ category_id: '00000000-0000-4000-8000-000000000001', wears: 'women', price_rupees: '', sizes: [] }).success, false);
  });
});

describe('the photo check (D-103)', () => {
  const side = 64;
  const flat = (v: number): Uint8Array => new Uint8Array(side * side).fill(v);
  const textured = new Uint8Array(side * side).map((_, i) => ((i * 7919) % 251));
  it('flags a small, dark, flat (blurry) photo', () => {
    const r = checkPhoto({ width: 800, height: 600, overview: flat(20), crop: flat(20), cropSide: side });
    assert.deepEqual(r.issues.sort(), ['blurry', 'dark', 'small']);
  });
  it('passes a big, well-lit, detailed photo', () => {
    const r = checkPhoto({ width: 3000, height: 4000, overview: flat(150), crop: textured, cropSide: side });
    assert.deepEqual(r.issues, []);
  });
});

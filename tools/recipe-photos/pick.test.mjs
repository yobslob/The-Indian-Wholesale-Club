// node --test tools/recipe-photos/pick.test.mjs: the recipe photo runner's choices (D-214).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { best, licences, nameWords, score, searchTerm } from './pick.mjs';

const photo = (title, downloads = 100, orientation = 'square') => ({
  id: title.length,
  title,
  image: { type: 'photo', orientation },
  stats: { downloads },
  licenses: [{ type: 'premium', url: 'https://example.test/licence' }],
});

test('the search is the name in the template', () => {
  assert.equal(searchTerm('Pav Bhaji'), 'Pav Bhaji indian food');
  assert.equal(searchTerm('Pav Bhaji', '{name} street food'), 'Pav Bhaji street food');
});

test("a name's own words, without filler", () => {
  assert.deepEqual(nameWords('Kaddu ke Pakode'), ['kaddu', 'pakode']);
  assert.deepEqual(nameWords('Chicken Shawarma (Kerala)'), ['chicken', 'shawarma']);
});

test('a title with every word of the dish beats a more popular one with only some', () => {
  const words = nameWords('Aloo Tikki Chaat');
  assert.ok(score(photo('Aloo tikki chaat on a plate', 50), words) > score(photo('Chaat in a bowl', 50000), words));
});

test('nothing that is not a photo, nothing unrelated, people count against', () => {
  const words = nameWords('Samosa');
  assert.equal(score({ ...photo('Samosa'), image: { type: 'vector' } }, words), 0);
  assert.equal(score(photo('Pizza slice'), words), 0);
  assert.ok(score(photo('Samosa with chutney'), words) > score(photo('Woman eating samosa'), words));
});

test('the best result, or null when none shows the dish', () => {
  const results = [photo('Pizza'), photo('Crispy samosa', 10, 'vertical'), photo('Samosa plate', 900)];
  assert.equal(best(results, 'Samosa').title, 'Samosa plate');
  assert.equal(best([photo('Pizza')], 'Samosa'), null);
  assert.equal(licences(results[0]), 'premium: https://example.test/licence');
});

test("founder, 2026-11-27: a photo holding only some of the dish's words is not the dish", () => {
  const naan = photo('butter, wild garlic, wild garlic butter, herbs, nature', 5000);
  const dal = photo('daal, chana, lentils, indian, cuisine, dal, food', 5000);
  assert.equal(best([naan], 'Butter Garlic Naan'), null);
  assert.equal(best([dal], 'Dal Makhani'), null);
  assert.equal(best([photo('naans, garlic, butter, indian bread')], 'Butter Garlic Naan').title, 'naans, garlic, butter, indian bread');
  // whole words only: "naan" is not in "naanwala"
  assert.equal(best([photo('naanwala garlic butter shop')], 'Butter Garlic Naan'), null);
});

test('a photo another recipe already has is skipped', () => {
  const one = photo('tandoori chicken, tikka', 900);
  const two = photo('tandoori chicken on a grill', 10);
  assert.equal(best([one, two], 'Tandoori Chicken', new Set([String(one.id)])), two);
});

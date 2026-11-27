// node --test tools/recipe-photos/judge.test.mjs: the GPU picker's scoring and Openverse's results (D-214).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GOOD_ENOUGH, MIN_SCORE, shortlist, verdictScore } from './judge.mjs';
import { fromOpenverse, licenceName, sizedUrl } from './openverse.mjs';

const verdict = (over = {}) => ({
  is_dish: true,
  main_subject: true,
  appetising: 8,
  sharp: 8,
  people: false,
  text_or_logo: false,
  cluttered: false,
  ...over,
});

test('not the dish, or one dish of a thali, scores nothing', () => {
  assert.equal(verdictScore(verdict({ is_dish: false })), 0);
  assert.equal(verdictScore(verdict({ main_subject: false })), 0);
});

test("founder's naan: a good-looking photo with printed faces and a book behind it falls under the floor", () => {
  const naan = verdict({ appetising: 8, sharp: 9, people: true, text_or_logo: true, cluttered: true });
  assert.equal(verdictScore(naan), 0);
  assert.ok(verdictScore(verdict({ appetising: 9, sharp: 9 })) >= GOOD_ENOUGH);
  assert.ok(verdictScore(verdict({ appetising: 7, sharp: 6 })) >= MIN_SCORE);
});

test('the shortlist: the whole name first, a title about the dish alone before a platter, never a used photo', () => {
  const r = (id, name, width = 1024, tags = []) => ({ id, name, title: [name, ...tags].join(', '), width });
  const results = [
    r('a', 'Chicken, Carrot, Mixed Veg Curries, Dosai, Idli, Uttapam - Chennai Banana Leaf', 1600),
    r('b', 'Rava Idli', 1024),
    r('c', 'Sambar', 2000),
    r('d', 'Idli', 900),
  ];
  assert.deepEqual(shortlist(results, 'Idli', 4).map((x) => x.id), ['b', 'd', 'a']);
  assert.deepEqual(shortlist(results, 'Idli', 4, new Set(['b'])).map((x) => x.id), ['d', 'a']);
  // half the words is enough to be looked at: the model decides
  assert.deepEqual(shortlist([r('e', 'Garlic Naan')], 'Butter Garlic Naan', 4).map((x) => x.id), ['e']);
  assert.deepEqual(shortlist([r('f', 'Butter')], 'Butter Garlic Naan', 4), []);
});

test("an Openverse result keeps what the credit needs: title, author, page, licence and its link", () => {
  const r = fromOpenverse({
    id: 'x1',
    title: 'Dal makhani',
    creator: 'TarnishedPath',
    foreign_landing_url: 'https://commons.wikimedia.org/w/index.php?curid=161833506',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Dal_makhani.jpg',
    license: 'by-sa',
    license_version: '4.0',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    width: 2848,
    height: 4272,
    tags: [{ name: 'food' }],
  });
  assert.equal(r.name, 'Dal makhani');
  assert.equal(r.title, 'Dal makhani, food');
  assert.equal(r.author.name, 'TarnishedPath');
  assert.deepEqual(r.licences, [{ type: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }]);
  assert.equal(r.download, 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Dal_makhani.jpg/1280px-Dal_makhani.jpg');
});

test('licence names and sized links', () => {
  assert.equal(licenceName('cc0', '1.0'), 'CC0 1.0');
  assert.equal(licenceName('pdm', '1.0'), 'Public Domain Mark 1.0');
  const flickr = 'https://live.staticflickr.com/2401/2239000538_a5135b3538_b.jpg';
  assert.equal(sizedUrl(flickr, 1024), flickr);
  assert.equal(sizedUrl('https://upload.wikimedia.org/wikipedia/commons/f/f8/Dal.jpg', 640), 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Dal.jpg');
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanSearch, editDistance, parseHints, searchWords, suggest, type SearchHints } from '../src/search';

const HINTS: SearchHints = {
  words: ['saree', 'kurta', 'kurti', 'silk', 'cotton', 'sandal', 'kerala', 'punjab', 'turmeric', 'kasavu', 'kanjeevaram'],
  synonyms: [
    ['punjab', 'punjabi'],
    ['haldi', 'turmeric'],
  ],
  categories: [
    { type: 'clothing', slug: 'sarees', name: 'Sarees & Drapes', count: 51 },
    { type: 'food', slug: 'ground-spices', name: 'Ground Spices', count: 40 },
  ],
  regions: [
    { slug: 'kerala', name: 'Kerala', count: 30 },
    { slug: 'punjab', name: 'Punjab', count: 48 },
    { slug: 'puducherry', name: 'Puducherry', count: 0 },
  ],
  popular: ['silk saree', 'kurta set', 'kasavu saree'],
};

const labels = (text: string, quick = false): string[] => suggest(text, HINTS, { quick }).map((s) => `${s.kind}:${s.label}`);

describe('search words (D-160)', () => {
  it('cleans a search as the database reads it', () => {
    assert.equal(cleanSearch('  silk   saree \n'), 'silk saree');
    assert.equal(cleanSearch('x'.repeat(150)).length, 100);
    assert.deepEqual(searchWords("Haldiram's T-shirt, 500g"), ['haldiram', 's', 't', 'shirt', '500g']);
    assert.deepEqual(searchWords('कुर्ता silk'), ['कुर्ता', 'silk']);
  });

  it('counts edits, giving up past the limit', () => {
    assert.equal(editDistance('kurta', 'kurta', 1), 0);
    assert.equal(editDistance('kurtha', 'kurta', 2), 1);
    assert.equal(editDistance('kutra', 'kurta', 2), 2);
    assert.equal(editDistance('saree', 'cotton', 1), 2);
  });
});

describe('suggestions while typing (D-160)', () => {
  it('an empty box offers the popular searches', () => {
    assert.deepEqual(labels(''), ['search:silk saree', 'search:kurta set', 'search:kasavu saree']);
  });

  it('completes the last word, most used first, after popular searches that begin the same', () => {
    assert.deepEqual(labels('kur'), ['search:kurta set', 'search:kurta', 'search:kurti']);
    assert.deepEqual(labels('silk sa'), ['search:silk saree', 'search:silk sandal']);
  });

  it('forgives a slip in a word being typed', () => {
    assert.ok(labels('kurth').includes('search:kurta'));
    assert.ok(labels('kanjiv').includes('search:kanjeevaram'));
    assert.ok(!labels('zzzq').some((l) => l.startsWith('search:')));
  });

  it('offers a state by its name or its people, and a category by a word of its name', () => {
    assert.ok(labels('ker').includes('state:Kerala'));
    assert.ok(labels('punjabi').includes('state:Punjab'));
    assert.ok(!labels('punj').includes('search:punjab'), 'the state, not also a search for its name');
    assert.equal(labels('pu').filter((l) => l.startsWith('state:'))[0], 'state:Punjab', 'more pieces first');
    assert.ok(labels('spic').includes('category:Ground Spices'));
    assert.ok(labels('saree').includes('category:Sarees & Drapes'));
  });

  it('the 7-day store has no states or categories to offer', () => {
    assert.ok(!labels('ker', true).some((l) => !l.startsWith('search:')));
  });

  it('never more than the limit, never one label twice', () => {
    const many = suggest('s', { ...HINTS, words: Array.from({ length: 50 }, (_, i) => `s${i}x`) }, { limit: 5 });
    assert.equal(many.length, 5);
    const twice = suggest('silk sa', { ...HINTS, popular: ['silk saree'], words: ['saree'] });
    assert.deepEqual(twice.map((s) => s.label), ['silk saree']);
  });
});

describe('the hints as received (D-160)', () => {
  it('keeps what is well formed and drops the rest', () => {
    const h = parseHints({
      words: ['saree', 3, null],
      synonyms: [['sari', 'saree'], ['alone'], 'x'],
      categories: [{ type: 'food', slug: 'sweets', name: 'Sweets', count: 9 }, { type: 'toys', slug: 't', name: 'T' }],
      regions: [{ slug: 'kerala', name: 'Kerala', count: '4' }, { slug: 1 }],
      popular: 'nope',
    });
    assert.deepEqual(h, {
      words: ['saree'],
      synonyms: [['sari', 'saree']],
      categories: [{ type: 'food', slug: 'sweets', name: 'Sweets', count: 9 }],
      regions: [{ slug: 'kerala', name: 'Kerala', count: 4 }],
      popular: [],
    });
    assert.deepEqual(parseHints(null).words, []);
  });
});

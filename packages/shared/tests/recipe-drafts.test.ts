import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ALL_OF_INDIA, recipeDraftFileSchema, slugFromFileName, type RecipeDraft } from '../src/domain';

/**
 * D-203, plan §7: the 100 drafted recipes (catalogue/recipes-drafts-1..5.json) import as they are, match the chosen
 * list (catalogue/recipes-100.csv), name only states the store has, and never put in a kit what IWC can't send
 * (fresh, dairy, oil, meat or anything liquid: D-135).
 */
const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

const drafts: RecipeDraft[] = [1, 2, 3, 4, 5].flatMap((n) =>
  recipeDraftFileSchema.parse(JSON.parse(read(`catalogue/recipes-drafts-${n}.json`))),
);
const csv = read('catalogue/recipes-100.csv')
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(','));
const regions = new Set([...read('supabase/seed/regions.sql').matchAll(/\('[a-z-]+', '([^']+)'/g)].map((m) => m[1]!));

const NOT_IN_A_KIT =
  /\b(milk|oil|ghee|butter|cream|yogu?rt|curd|water|buttermilk|chicken|mutton|fish|eggs?|paneer|meat|mince|vinegar|soy sauce|coconut milk|fresh)\b/i;

describe('the 100 drafted recipes (D-203)', () => {
  it('five files of 20 that import, one per dish on the list, in its order', () => {
    assert.equal(drafts.length, 100);
    assert.deepEqual(
      drafts.map((d) => d.slug),
      csv.map((c) => c[1]),
    );
    for (const [i, d] of drafts.entries()) {
      const row = csv[i]!;
      assert.equal(d.name, row[2], d.slug);
      assert.equal(d.kind, row[3], d.slug);
      assert.equal(d.state, row[4], d.slug);
      assert.equal(slugFromFileName(`${d.name.replace(/ /g, '_')}.JPG`).length > 0, true);
    }
  });

  it('every state is one the store has, or All of India', () => {
    for (const d of drafts) assert.ok(d.state === ALL_OF_INDIA || regions.has(d.state), `${d.slug}: ${d.state}`);
  });

  it('every recipe has a kit, and nothing fresh, dairy, oily, meaty or liquid is in one', () => {
    for (const d of drafts) {
      const kit = d.ingredients.filter((l) => l.source === 'iwc');
      assert.ok(kit.length > 0, `${d.slug} has no IWC line`);
      // a masala's name may say chicken or butter (D-200's rule): it is a dry blend
      for (const l of kit) if (!/masala/i.test(l.label)) assert.doesNotMatch(l.label, NOT_IN_A_KIT, `${d.slug}: ${l.label}`);
      for (const l of kit) assert.ok((l.match_words ?? '').length > 0, `${d.slug}: ${l.label} has no match words`);
    }
  });

  it('the voice rule: none of the banned words (storefront.md §Voice)', () => {
    const banned = /\b(authentic|rich|vibrant|aromatic|journey|delectable|mouth-?watering)\b/i;
    for (const d of drafts) {
      assert.doesNotMatch(d.blurb, banned, d.slug);
      for (const s of d.steps) assert.doesNotMatch(s.text, banned, d.slug);
    }
  });

  it('a photo file name finds its recipe (Add photos by name)', () => {
    assert.equal(slugFromFileName('Pav Bhaji.JPG'), 'pav-bhaji');
    assert.equal(slugFromFileName('chicken_biryani.png'), 'chicken-biryani');
  });
});

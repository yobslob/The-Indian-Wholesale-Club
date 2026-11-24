import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ALL_OF_INDIA,
  recipeDraftFileSchema,
  slugFromFileName,
  type RecipeDraft,
} from '../src/domain';

/**
 * D-203, plan §7: the drafted recipes (catalogue/recipes-drafts-1..25.json; D-204 added 6..10, the founder's 300 more
 * of 2026-11-25 added 11..25) import as they are, match their lists (catalogue/recipes-100.csv, recipes-101-200.csv,
 * recipes-201-500.csv), have no two dishes alike by slug or name, name only states the store has, and never put
 * in a kit what IWC can't send (fresh, dairy, oil, meat or anything liquid: D-135). A dry swap stands in only for a
 * fresh, local line of its own recipe (D-204).
 */
const root = new URL('../../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

const FILES = Array.from({ length: 25 }, (_, i) => i + 1);
const drafts: RecipeDraft[] = FILES.flatMap((n) =>
  recipeDraftFileSchema.parse(JSON.parse(read(`catalogue/recipes-drafts-${n}.json`))),
);
const csv = [
  'catalogue/recipes-100.csv',
  'catalogue/recipes-101-200.csv',
  'catalogue/recipes-201-500.csv',
].flatMap((file) =>
  read(file)
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(',')),
);
const regions = new Set(
  [...read('supabase/seed/regions.sql').matchAll(/\('[a-z-]+', '([^']+)'/g)].map((m) => m[1]!),
);

const NOT_IN_A_KIT =
  /\b(milk|oil|ghee|butter|cream|yogu?rt|curd|water|buttermilk|chicken|mutton|fish|eggs?|paneer|meat|mince|vinegar|soy sauce|coconut milk|fresh)\b/i;

describe('the 500 drafted recipes (D-203, D-204)', () => {
  it('25 files of 20 that import, one per dish on the lists, in their order', () => {
    assert.equal(drafts.length, 500);
    assert.equal(new Set(drafts.map((d) => d.slug)).size, 500);
    const plain = (name: string): string => name.toLowerCase().replace(/[^a-z]/g, '');
    assert.equal(new Set(drafts.map((d) => plain(d.name))).size, 500, 'two dishes share a name');
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
      assert.equal(d.rank, i + 1, d.slug);
    }
  });

  it('every state is one the store has, or All of India', () => {
    for (const d of drafts)
      assert.ok(d.state === ALL_OF_INDIA || regions.has(d.state), `${d.slug}: ${d.state}`);
  });

  it('every recipe has a kit, and nothing fresh, dairy, oily, meaty or liquid is in one', () => {
    for (const d of drafts) {
      const kit = d.ingredients.filter((l) => l.source === 'iwc');
      assert.ok(kit.length > 0, `${d.slug} has no IWC line`);
      // a masala's name may say chicken or butter (D-200's rule): it is a dry blend
      for (const l of kit)
        if (!/masala/i.test(l.label))
          assert.doesNotMatch(l.label, NOT_IN_A_KIT, `${d.slug}: ${l.label}`);
      for (const l of kit)
        assert.ok((l.match_words ?? '').length > 0, `${d.slug}: ${l.label} has no match words`);
    }
  });

  it('a swap stands in for a fresh, local line of its own recipe and is never also a main piece (D-204)', () => {
    let swaps = 0;
    for (const d of drafts) {
      const local = new Set(d.ingredients.filter((l) => l.source === 'local').map((l) => l.label));
      const main = new Set(
        d.ingredients.filter((l) => l.source === 'iwc' && !l.instead_of).map((l) => l.match_words),
      );
      for (const l of d.ingredients.filter((x) => x.instead_of)) {
        swaps += 1;
        assert.ok(
          local.has(l.instead_of!),
          `${d.slug}: ${l.label} stands in for ${l.instead_of}, not a local line`,
        );
        assert.ok(!main.has(l.match_words), `${d.slug}: ${l.label} is already in the kit`);
      }
    }
    assert.ok(swaps > 300);
    const biryani = drafts.find((d) => d.slug === 'chicken-biryani')!;
    assert.ok(
      biryani.ingredients.some(
        (l) => l.label === 'Coriander powder' && l.instead_of === 'Coriander',
      ),
    );
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

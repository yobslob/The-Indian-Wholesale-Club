/**
 * Founder, 2026-11-27: Pro.Fitness oats (a 900 g pack) was priced on "27g High Protein" in its name, and Samrat's
 * Bikaneri Sev was named "Samrat" (its title "Samrat | Bikaneri Sev | 400g" cut at the first "|"). Both from real
 * titles in tools/sourcing-runner/sourcing.log.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { packGrams, parseWeight } from '../src/sourcing';
import {
  beforeTheBar,
  blinkitItem,
  buildListing,
  checkWeight,
  listingName,
  nameFromTitle,
  pagePack,
  type VerifyVariant,
} from '../src/sourcing/auto';

import type { SourcedProduct } from '../src/sourcing';
import type { SourcingShop, SourcingTarget } from '../src/sourcing/auto';
import { foodNet } from '../src/sourcing/estimate/food';
import { withoutNutrients } from '../src/sourcing/weight';

const net = (name: string, label = 'One size'): string | undefined =>
  foodNet({ name, description: null }, { label, options: {}, weight_source: null, weight_note: null })?.label;

describe('a nutrient claim is never the pack', () => {
  it('drops grams of protein or fibre from a name', () => {
    assert.equal(packGrams('Pro.Fitness 27g High Protein Oats By Myfitness'), null);
    assert.equal(packGrams('Yoga Bar 26g High Protein Oats Dark Chocolate'), null);
    assert.equal(packGrams('Alpino 25g High Protein Super Oats Chocolate'), null);
    assert.equal(net('Saffola Hi-Protein Oats 25g Protein + 14g Fibre'), undefined);
    assert.equal(packGrams('Protein: 20 g Peanut Butter Crunchy 1 kg'), 1000);
  });
  it('keeps the pack when the name says both', () => {
    assert.equal(packGrams('Pro.Fitness 27g High Protein Oats 900 g'), 900);
    assert.equal(net('Yoga Bar 26g High Protein Oats 850g'), '850 g');
    assert.equal(net('Pro.Fitness 27g High Protein Oats', '900 g'), '900 g');
  });
  it('keeps real packs that name a nutrient', () => {
    assert.equal(packGrams('Dlite 75 g Sugar Free Cookies'), 75);
    assert.equal(packGrams('Sugar 1 kg'), 1000);
    assert.equal(packGrams('Uttam Sugar 500 g'), 500);
    assert.equal(packGrams('Whey Protein Powder 1 kg'), 1000);
    assert.equal(parseWeight('Protein Bar 60 g')?.grams, 60);
  });
  it('drops small sugar and fat claims only', () => {
    assert.equal(withoutNutrients('0g sugar granola 400 g').trim().replace(/\s+/g, ' '), 'granola 400 g');
    assert.equal(packGrams('Granola 0g Trans Fat 400 g'), 400);
    assert.equal(packGrams('Mishri Sugar Candy 100g'), 100);
  });
});

describe('the name before the shop\'s "|"', () => {
  it('joins the next part when the first is only the brand', () => {
    assert.equal(beforeTheBar('Samrat | Bikaneri Sev | 400g'), 'Samrat Bikaneri Sev');
    assert.equal(listingName('Samrat | Bikaneri Sev | 400g'), 'Samrat Bikaneri Sev');
    assert.equal(
      listingName('JOLKHABAR | Chanachur Monthly Combo Pack | Tok Jhal Misti - Jhal Combo'),
      'JOLKHABAR Chanachur Monthly Combo Pack',
    );
    assert.equal(
      listingName('Andhra Store | Red Chilli Pickle | Pandu Mirchi Pickle', 'Andhra Store'),
      'Andhra Store Red Chilli Pickle',
    );
  });
  it('takes the next part only up to its dash, six words at most, and never twice', () => {
    assert.equal(
      listingName('Manan | Dum Aloo Masala - Premium Blend for Rich & Spicy Potatoes in Traditional'),
      'Manan Dum Aloo Masala',
    );
    assert.equal(listingName('Dalmoth | Dalmoth Namkeen | 400 g'), 'Dalmoth Namkeen');
  });
  it('keeps a first part that already names the piece', () => {
    assert.equal(listingName("Athavale's Bakarwadi | Classic puneri bakarwadi | snacks"), "Athavale's Bakarwadi");
    assert.equal(listingName('Thepla Masala 100g | Agri Club'), 'Thepla Masala');
    assert.equal(listingName('Andhra Store | Red Chilli Pickle'), 'Andhra Store');
    assert.equal(listingName('Ishayu|Coatz – Tangy spiced cashews'), 'Ishayu|Coatz – Tangy spiced cashews');
  });
});

describe("a page of one pack keeps the shop's own pack field", () => {
  const shop: SourcingShop = {
    site: 'zepto.com',
    label: 'Zepto',
    reader: 'zepto',
    product_types: ['food'],
    delivery_days: 1,
  };
  const target: SourcingTarget = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Oats',
    query: 'oats',
    must_match: 'oats',
    product_type: 'food',
    category: 'rice-flours-and-staples',
    region: null,
    tier: 1,
    sites: null,
    min_price_paise: null,
    max_price_paise: null,
    listings: null,
  };
  const product: SourcedProduct = {
    url: 'https://www.zepto.com/pn/x/pvid/abc-123',
    site: 'zepto.com',
    title: 'Pro.Fitness 27g High Protein Oats By Myfitness|Dark Chocolate Oats With Almonds',
    brand: 'Pro.Fitness',
    description: '',
    bullets: [],
    specs: [],
    images: ['https://cdn.zeptonow.com/production/a.jpg'],
    pricePaise: 39900,
    mrpPaise: 49900,
    currency: 'INR',
    inStock: true,
    sizes: [],
    hints: [],
    variants: [],
    deliveryText: null,
  };
  const build = (p: SourcedProduct) =>
    buildListing({ product: p, target, shop, pageDays: 1, family: [], others: [], shops: [shop], maxDays: 3, now: new Date('2026-11-27T00:00:00Z') });

  it('prices it on the pack, not on the protein', () => {
    const draft = build({ ...product, pack: '900 g' });
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.deepEqual(draft.listing.variants.map((v) => [v.label, v.weight_g]), [['900 g', 900]]);
  });
  it('without a pack field, the protein is still no weight', () => {
    const draft = build(product);
    assert.ok(!('skip' in draft));
    if ('skip' in draft) return;
    assert.equal(draft.listing.variants[0]!.weight_g ?? null, null);
  });
  it("reads Blinkit's unit from its item page", () => {
    const state = { a: { product_id: '42', price: 120, mrp: 150, inventory: 3, unit: '400 g' } };
    assert.deepEqual(blinkitItem(state, '42'), { pricePaise: 12000, mrpPaise: 15000, inStock: true, pack: '400 g' });
  });
});

describe('pnpm sourcing verify: what a page decides', () => {
  const page: SourcedProduct = {
    url: 'https://www.zepto.com/pn/x/pvid/abc-123',
    site: 'zepto.com',
    title: 'Pro.Fitness 27g High Protein Oats By Myfitness',
    brand: 'Pro.Fitness',
    description: '',
    bullets: [],
    specs: [],
    images: [],
    pricePaise: 39900,
    mrpPaise: null,
    currency: 'INR',
    inStock: true,
    sizes: [],
    hints: [],
    variants: [],
    deliveryText: null,
  };
  const v = (over: Partial<VerifyVariant> = {}): VerifyVariant => ({
    id: '00000000-0000-4000-8000-0000000000aa',
    label: '27 g',
    weight_g: 27,
    weight_source: 'packed',
    net_qty: '27 g',
    is_active: true,
    ...over,
  });

  it("fixes the oats from the shop's own pack field", () => {
    const pack = pagePack({ ...page, pack: '900 g' }, null);
    assert.equal(pack?.from, 'pack');
    const c = checkWeight(page.title, v(), pack, 'zepto.com');
    assert.equal(c.verdict, 'fix');
    assert.equal(c.write?.weight_g, 900);
    assert.equal(c.write?.net_qty, '900 g');
  });
  it('a net quantity row counts; a title alone only asks for a look; the protein is no pack at all', () => {
    const net = pagePack({ ...page, specs: [['Net Quantity', '1 kg']] }, null);
    assert.equal(checkWeight(page.title, v(), net, 'amazon.in').verdict, 'fix');
    const titled = pagePack({ ...page, title: 'Rajma Chitra 500 g' }, null);
    assert.equal(titled?.from, 'title');
    assert.equal(checkWeight('Rajma', v({ weight_g: 1000 }), titled, 'amazon.in').verdict, 'check');
    assert.equal(pagePack(page, null), null);
  });
  it('never changes what the hub weighed or an admin typed, and leaves a close weight alone', () => {
    const pack = pagePack({ ...page, pack: '900 g' }, null);
    assert.equal(checkWeight(page.title, v({ weight_source: 'weighed', weight_g: 940 }), pack, 'zepto.com').verdict, 'kept');
    assert.equal(checkWeight(page.title, v({ weight_g: 910 }), pack, 'zepto.com').verdict, 'ok');
  });
  it('makes a cut food name again, never one an admin wrote', () => {
    assert.equal(nameFromTitle('Samrat', 'Samrat | Bikaneri Sev | 400g', 'Samrat'), 'Samrat Bikaneri Sev');
    assert.equal(nameFromTitle('Bikaneri Sev by Samrat', 'Samrat | Bikaneri Sev | 400g', 'Samrat'), null);
    assert.equal(nameFromTitle("Athavale's Bakarwadi", "Athavale's Bakarwadi | Classic puneri | snacks", null), null);
    assert.equal(nameFromTitle('Samrat', null, null), null);
  });
});

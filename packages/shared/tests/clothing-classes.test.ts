/**
 * D-132: clothing is weighed by the founder's four classes. Real titles from the shops (Myntra, the catalogue), each
 * with the class a person would give it: sets before single pieces, brand names and motifs not mistaken for garments.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { weightState } from '../src/domain';
import {
  classGrams,
  classifyClothing,
  classWrites,
  readClass,
  type ClothingClass,
  type ClothingListing,
} from '../src/sourcing/estimate';

const cases: [string, ClothingClass, string?][] = [
  // light 350 g: headwear, jhumka, kurti, kurta, tops, salwar
  ['Vastraa Fusion Unisex Grey & Green Solid Himachali Kullu Topi with Patti on Front', 'light'],
  [
    'Rubans 18K Gold-Plated Pink Kundan & White Beads Studded Enamel Handcrafted Dome Jhumka',
    'light',
  ],
  ['NY LIFESTYLES Set Of 10 Beaded Lac Bangle', 'light'],
  ['Chooda and kalire set', 'light'],
  ['Libas Blue Floral Printed Straight Short Kurti', 'light'],
  ['Anouk Men Polka Dot Printed Pure Cotton Kurta', 'light'],
  ['Kurta for jeans', 'light'],
  ['Snitch Ethnic Motifs Cotton Long Sleeves Shirt', 'light'],
  ['DIVINE Women Maroon V-Neck Long Sleeves Solid Saree Blouse', 'light'],
  ['Go Colors White Relaxed Fit Solid Salwar', 'light'],
  ['Nath-motif blouse', 'light'],
  // the founder, 2026-10-16: gamosa, kaftan, dress or skirt are light
  ['Gamosa', 'light'],
  ['Boho kaftan', 'light'],
  ['HERE&NOW Printed Pure Cotton Square Neck Gown Ethnic Dresses', 'light'],
  ['Taavi Women Kalamkari Pure Cotton Floral Midi A-Line Skirt', 'light'],
  ['Cargo skirt', 'light'],
  // medium 750 g: light sarees, dupatta, potli, (heavier) kurta, dhoti, jackets, co-ords, dresses
  ['Anouk Paisley Pure Cotton Handloom Bagru Ready to Wear Saree', 'medium'],
  ['KALINI Bandhani Zari Pure Georgette Fusion Bandhani Saree', 'medium'],
  ['Sangria Zari Kerala Kasavu Saree With Unstitched Blouse', 'medium'],
  [
    'FashionsEye Floral Embroidered Sequinned Pure Georgette Saree And Unstiched Blouse Piece',
    'medium',
  ],
  ['Kolhapuri saree', 'medium'],
  ['Coloured-border set saree', 'medium'],
  ['ZOOMBIE Ethnic Motifs Embroidered Zari Banarasi Silk Dupatta', 'medium'],
  ['LADY QUINTON Women Crystal Rhinestone Evening Potli Clutch', 'medium'],
  ['Araaha Women Embellished Mirror Work Anarkali Kurta', 'medium'],
  ['Poshak Hub Women Georgette Anarkali Kurta', 'medium', 'a brand, not a poshak'],
  ['Dincharya Men Ethnic Motifs Printed Sequinned Floral Kurta', 'medium'],
  ['VASTRAMAY Men White Solid Cotton Dhoti', 'medium'],
  ['Badoliya & Sons Pure Wool Woven Nehru Jackets', 'medium'],
  ['Handloom co-ord set', 'medium', 'a co-ord set stays medium'],
  ['Gamosa-motif bag', 'medium', 'a bag, not a gamosa'],
  ['Gamosa-motif stole', 'medium'],
  ['Ludhiana muffler', 'medium'],
  // 800 g: pants, jeans, footwear
  ['FANZI Men Ankle-Length Printed Dhoti Pants', 'bottoms'],
  ['Japan-fit baggy jeans', 'bottoms'],
  ['House of Pataudi Men Slip-On Kolhapuri Comfort Sandals', 'bottoms'],
  ['FAUSTO Men Ethnic Wedding Traditional Textured Slip On Juttis and Mojaris', 'bottoms'],
  // heavy 1.5 kg: shawls, very heavy sarees, lehengas, any set
  ['SOURAGYA Women Ethnic Winter Paisley Woven Design Pashmina Shawl', 'heavy'],
  ['Exotic India True Blue Wool Kashmiri Phiran with Aari Hand-Embroidery on Neck', 'heavy'],
  ['Paithani saree', 'heavy'],
  ['White silk bridal saree', 'heavy'],
  ['Bridal kasavu with brocade blouse', 'heavy'],
  ['FASHION DREAM Girls Floral Printed Georgette Ready to Wear Lehenga & Choli', 'heavy'],
  ['Sangria Girls Printed Cotton Round Neck Flared Lehenga Choli', 'heavy'],
  ['joley poley Boys Sequin Embellished Mandarin Collar Sherwani', 'heavy'],
  ['Anouk Men Printed Regular Kurta with Pyjamas And Nehru jacket', 'heavy'],
  ['KJFAB Women Ethnic Motifs Printed Regular Pure Cotton Kurta with Trousers', 'heavy'],
  ['Boys’ mini mundu and shirt', 'heavy'],
  ['Kurta and tehmat', 'heavy'],
  ['Cotton kurta-pajama', 'heavy'],
  ['Sangria Boys Peach Kurta Sets', 'heavy'],
  ['Pathani suit', 'heavy'],
  ['KALINI Embroidered Pure Cotton Unstitched Dress Material', 'heavy'],
  ['Lagorii Girls Embroidered Thread Work Puff Sleeves Ready to Wear Pattu Pavadai', 'heavy'],
];

describe('clothing classes (D-132)', () => {
  for (const [name, cls, because] of cases)
    it(`${name} → ${cls}${because ? ` (${because})` : ''}`, () => {
      assert.equal(classifyClothing({ name, categorySlug: null })?.cls, cls);
    });

  it('falls back to the category when the name says nothing, and to nobody when neither does', () => {
    assert.deepEqual(classifyClothing({ name: 'Dimasa rigu', categorySlug: 'sarees' }), {
      cls: 'medium',
      why: 'its category (sarees)',
      by: 'category',
    });
    assert.equal(classifyClothing({ name: 'Kota Doria fabric', categorySlug: 'fabrics' }), null);
  });

  it('weighs a pack as that many pieces, and leaves a person’s weight alone', () => {
    assert.equal(classGrams('light', { pack: 'Pack of 3' }), 1050);
    assert.equal(classGrams('light', {}, 'Cozyplay Pack of 2 Mid Rise Patiala'), 700);
    assert.equal(
      classGrams('light', {}, 'NY LIFESTYLES Set Of 10 Beaded Lac Bangle'),
      350,
      'a set of bangles is one piece',
    );
    const listing: ClothingListing = {
      product_id: '00000000-0000-4000-8000-000000000001',
      name: 'Pathani suit',
      category_slug: 'suits-and-sets',
      category: 'Suits & sets',
      summary: null,
      attributes: {},
      variants: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          label: 'M',
          options: {},
          weight_g: 420,
          weight_source: 'shop',
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          label: 'L',
          options: {},
          weight_g: 900,
          weight_source: 'weighed',
        },
      ],
    };
    assert.deepEqual(classWrites(listing, 'heavy', 'a set (suit)'), [
      {
        variant_id: '00000000-0000-4000-8000-000000000002',
        weight_g: 1500,
        note: 'Heavy, 1.5 kg: a set (suit) (D-132)',
      },
    ]);
  });

  it("reads the model's class and nothing else", () => {
    assert.deepEqual(readClass('{"class": "heavy", "why": "a three-piece set"}'), {
      cls: 'heavy',
      why: 'a three-piece set',
    });
    assert.equal(readClass('{"class": "very heavy", "why": ""}'), null);
    assert.equal(readClass('not json'), null);
  });

  it('counts a class weight as confirmed, never unusual', () => {
    assert.equal(weightState({ weight_g: 1500, weight_source: 'class' }, true), 'confirmed');
  });
});

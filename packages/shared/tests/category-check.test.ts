import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checkCategory, notOfType } from '../src/sourcing/category-check';

// Names as they were filed on the production copy of 2026-10-24 (the live store's listings).
const move = (name: string, type: 'food' | 'home', from: string): string | null => {
  const c = checkCategory(name, type, from);
  return c.kind === 'move' ? c.to : null;
};

describe('a listing in its own category (founder, 2026-10-24)', () => {
  it('moves a name that plainly says another category', () => {
    assert.equal(move('Ganpatjee Mango pickle', 'food', 'masala-blends'), 'pickles-and-chutneys');
    assert.equal(move('Devavo Mumbai Vada Pav Chutney', 'food', 'masala-blends'), 'pickles-and-chutneys');
    assert.equal(move('Leeford Detox Kahwa Green Tea', 'food', 'masala-blends'), 'tea-and-drinks');
    assert.equal(move('Whole Farm Premium Black Cardamom Whole (Badi Elaichi)', 'food', 'papad-and-wadi'), 'whole-spices');
    assert.equal(move('Patang Puneri Bhakarwadi Namkeen', 'food', 'papad-and-wadi'), 'snacks-and-namkeen');
    assert.equal(move('Haldiram\'s Medium Masala Papad', 'food', 'masala-blends'), 'papad-and-wadi');
    assert.equal(move('YFP SAHIBJI Soan Papdi', 'food', 'snacks-and-namkeen'), 'sweets');
    assert.equal(move('Rajdhani Thick Poha', 'food', 'snacks-and-namkeen'), 'rice-flours-and-staples');
    assert.equal(move('Chukde Garam Masala Whole (Sabut Garam Masala)', 'food', 'masala-blends'), 'whole-spices');
    assert.equal(move('Jaipan Premium Induction Base Chapati Tawa 280mm', 'home', 'handicrafts-and-decor'), 'thaali-and-serveware');
    assert.equal(move('Shubhkart Nirmal Loban Dhoop Candy', 'home', 'handicrafts-and-decor'), 'pooja-and-spiritual');
  });

  it('leaves a name that fits its own category, or carries another word in passing', () => {
    for (const [name, from] of [
      ['Mother\'s Recipe Mixed Pickle Bottle', 'pickles-and-chutneys'],
      ['RealNut Roasted Masala Cashew Nuts W240', 'snacks-and-namkeen'],
      ['VIMAL Fresh Bhavnagari Gathiya, Authentic Gujarati Tea Time Snack', 'snacks-and-namkeen'],
      ['Nature\'s Bridge Aam Papad', 'sweets'],
      ['Mr. Merchant Green Madrasi Saunf Mukhwas Mouth Freshener Mix', 'sweets'],
      ['Aadhil Kovilpatti Traditional Peanut-Jaggery Balls (Kadalai Urundai)', 'sweets'],
      ['Ghee Ariselu (Adhirasam)', 'sweets'],
      ['Kellogg\'s Chocos, Moons and Stars Duet, Crunchy Bites and Chhota Laddoo', 'rice-flours-and-staples'],
      ['Bournvita Chocolate Nutrition Drink Jar', 'tea-and-drinks'],
      ['Mirza Sahab Rogan Josh & Achar Mutton Masala', 'masala-blends'],
      ['DT Nuts Coriander Powder, Red Chilli Powder and Roasted Cumin Powder', 'masala-blends'],
      ['Tasty Snacks Laung Sev', 'snacks-and-namkeen'],
      ['Vishalta Nylon Poha for Chivda Thin 500 Gm', 'rice-flours-and-staples'],
    ] as const)
      assert.equal(move(name, 'food', from), null, name);
    for (const [name, from] of [
      ['Kalash Charan Swastik Sticker', 'handicrafts-and-decor'],
      ['Pure Copper Shree Yantra Copper Plate', 'pooja-and-spiritual'],
      ['Brass Industry Metal Decorative Urli Bowl Tealight Holder Stand Set of 3', 'handicrafts-and-decor'],
    ] as const)
      assert.equal(move(name, 'home', from), null, name);
  });

  it('says when a listing is not its type at all', () => {
    assert.match(notOfType('Himalayan Yak Chews for Dogs', 'food') ?? '', /pet/);
    assert.match(notOfType('Dabur Almond Hair Oil', 'food') ?? '', /toiletry/);
    assert.match(notOfType('Ghasitaram Gifts for Brothers Sweets Box - Soan Papdi with Rakhi', 'food') ?? '', /rakhi/);
    assert.match(notOfType('Cinnamon Dhoop Sticks Pack of 2 with Ceramic Holder', 'food') ?? '', /pooja/);
    assert.match(notOfType('Pure Cow Ghee Mysore Pak by GO DESi', 'home') ?? '', /food/);
    assert.deepEqual(checkCategory('Purepet Fresh Dog Food', 'food', 'rice-flours-and-staples').kind, 'not_type');
    // Laddu Gopal is Krishna; mithai-shaped candles, candy jars and a pet jar are what they say
    for (const name of ['Brass Laddu Gopal Idol', 'Handmade Motichoor Laddu Scented Candles (Set of 4)', 'Flower Pattern Glass Candy Jar with Lid'])
      assert.equal(notOfType(name, 'home'), null, name);
    assert.equal(notOfType('Amla Murabba 500G Pet Jar', 'food'), null);
  });

  it('leaves clothing alone', () => {
    assert.deepEqual(checkCategory('Cotton Kurta with Pickle Print', 'clothing', 'kurtas'), { kind: 'ok' });
  });
});

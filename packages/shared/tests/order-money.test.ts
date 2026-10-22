import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { invoiceB, landedCostPaise, marginPct, orderRevenueCents, shopBillTotalPaise } from '../src/domain';
import { shopCartUrl } from '../src/sourcing';

describe("an order's invoices (D-140, F4)", () => {
  it('B: shop price ÷ 0.90 + weight × ₹2, times the quantity', () => {
    // ₹1,000 ÷ 0.90 = ₹1,111.11 + 400 g × ₹2 = ₹800 → ₹1,911.11 a piece, two pieces ₹3,822.22
    assert.equal(landedCostPaise({ shopPaise: 100000, weightG: 400, weighed: false, quantity: 2 }), 382222);
    assert.equal(landedCostPaise({ shopPaise: null, weightG: 400, weighed: false, quantity: 1 }), null);
    const b = invoiceB([
      { shopPaise: 100000, weightG: 400, weighed: true, quantity: 2 },
      { shopPaise: 20000, weightG: 200, weighed: false, quantity: 1 },
    ]);
    assert.equal(b.totalPaise, 382222 + 62222);
    assert.equal(b.totalCents, Math.round((382222 + 62222) / 92));
    assert.equal(b.final, false, 'provisional until every piece is weighed at the hub');
    assert.equal(invoiceB([{ shopPaise: 100000, weightG: 400, weighed: true, quantity: 1 }]).final, true);
    assert.equal(invoiceB([{ shopPaise: null, weightG: 400, weighed: true, quantity: 1 }]).missing, 1);
  });

  it('C adds its rows, a coupon as a minus; margins are over what the customer paid less tax and refunds', () => {
    assert.equal(shopBillTotalPaise([{ unit_paise: 95000, quantity: 2 }, { unit_paise: 4000, quantity: 1 }, { unit_paise: -10000, quantity: 1 }]), 184000);
    assert.equal(orderRevenueCents({ total_cents: 10800, tax_cents: 800, refunded_cents: 0 }), 10000);
    assert.equal(marginPct(10000, 6000), 40);
    assert.equal(marginPct(0, 10), null);
  });
});

describe('ordering several pieces from one shop at once (D-140, F3)', () => {
  it("builds Amazon's add-to-cart link from the ASINs", () => {
    assert.equal(
      shopCartUrl([
        { itemUrl: 'https://www.amazon.in/dp/B0ABCDEF12', quantity: 1 },
        { itemUrl: 'https://www.amazon.in/Some-Name/dp/b0zzzzzz99?th=1', quantity: 3 },
      ]),
      'https://www.amazon.in/gp/aws/cart/add.html?ASIN.1=B0ABCDEF12&Quantity.1=1&ASIN.2=B0ZZZZZZ99&Quantity.2=3',
    );
  });
  it("builds a Shopify shop's cart link from the variant ids", () => {
    assert.equal(
      shopCartUrl([
        { itemUrl: 'https://nishorama.com/products/kurta?variant=4455667788', quantity: 2 },
        { itemUrl: 'https://nishorama.com/products/saree?variant=1122334455', quantity: 1 },
      ]),
      'https://nishorama.com/cart/4455667788:2,1122334455:1',
    );
  });
  it('has none for shops without one, mixed shops or an item it cannot read', () => {
    assert.equal(shopCartUrl([{ itemUrl: 'https://www.myntra.com/kurtas/x/123/buy', quantity: 1 }]), null);
    assert.equal(shopCartUrl([{ itemUrl: 'https://www.amazon.in/dp/B0ABCDEF12', quantity: 1 }, { itemUrl: 'https://nishorama.com/products/a?variant=1234567', quantity: 1 }]), null);
    assert.equal(shopCartUrl([{ itemUrl: 'https://www.amazon.in/s?k=kurta', quantity: 1 }]), null);
    assert.equal(shopCartUrl([]), null);
  });
});

describe('who a piece is for (D-140, F2)', async () => {
  const { wearsFromHints, wearsFromName } = await import('../src/domain');
  it('reads the name as the database does: kids first, then unisex, women, men, then garments', () => {
    assert.equal(wearsFromName("Women's Anarkali Kurta"), 'women');
    assert.equal(wearsFromName('Men Pathani Suit'), 'men');
    assert.equal(wearsFromName('Girls Lehenga Choli'), 'kids');
    assert.equal(wearsFromName('Kanjivaram silk saree'), 'women');
    assert.equal(wearsFromName('Silk Sherwani'), 'men');
    assert.equal(wearsFromName('Unisex Nehru Jacket'), 'unisex');
    assert.equal(wearsFromName('Bootcut jeans'), null);
  });
  it("takes a shop's own gender field", () => {
    assert.equal(wearsFromHints(['Kurtas', 'Topwear', 'Apparel', 'Women']), 'women');
    assert.equal(wearsFromHints(['Boys']), 'kids');
    assert.equal(wearsFromHints(['Kurtas']), null);
  });
});

describe("IWC's name for a shop's title (D-140, L1; only the shop's name goes, 2026-10-21)", async () => {
  const { cleanTitle, startsWithBrand } = await import('../src/sourcing');
  it('drops the brand or shop and keeps every other word', () => {
    assert.equal(cleanTitle('House of Pataudi Embroidered Mandarin Collar Kurta', { brand: 'House of Pataudi', productType: 'clothing' }),
      'Embroidered Mandarin Collar Kurta');
    assert.equal(
      cleanTitle('TWINS LADY Women Ethnic Motifs Embroidered Regular Thread Work Kurta with Trousers & With Dupatta', { brand: 'TWINS LADY', productType: 'clothing' }),
      'Women Ethnic Motifs Embroidered Regular Thread Work Kurta with Trousers & With Dupatta',
    );
    assert.equal(cleanTitle('The Wallet Store Ishq-E-Jhumka Gold Plated Jhumka Earrings for Women', { brand: 'The Wallet Store', productType: 'home' }),
      'Ishq-E-Jhumka Gold Plated Jhumka Earrings for Women');
    assert.equal(cleanTitle('Aaliya Halterneck Kurti', { productType: 'clothing' }), 'Aaliya Halterneck Kurti');
    assert.equal(cleanTitle('Phulkari Kurta (Men)', { productType: 'clothing' }), 'Phulkari Kurta (Men)');
  });
  it('never cuts what the piece is: counts, sets, materials (the founder\'s examples)', () => {
    assert.equal(cleanTitle('3 in 1 Incense Sticks for Pooja', { productType: 'home' }), '3 in 1 Incense Sticks for Pooja');
    assert.equal(cleanTitle('100% Pure Brass Urli Bowl for Home Decor, Diwali Decoration', { productType: 'home' }),
      '100% Pure Brass Urli Bowl for Home Decor, Diwali Decoration');
    assert.equal(cleanTitle('Cycle 3 in 1 Agarbatti Combo Pack', { brand: 'Cycle', productType: 'home' }), '3 in 1 Agarbatti Combo Pack');
    assert.equal(cleanTitle('Amazon Brand - Solimo Brass Diya, Set of 2', { brand: 'Solimo', productType: 'home' }), 'Brass Diya, Set of 2');
    assert.equal(cleanTitle('Brass Kuber Diya by Ekhasa', { brand: 'Ekhasa', productType: 'home' }), 'Brass Kuber Diya');
    assert.equal(cleanTitle('Brass Kuber Diya | Ekhasa', { brand: 'Ekhasa', productType: 'home' }), 'Brass Kuber Diya');
    assert.equal(cleanTitle('Handwoven Ikat Dupatta - Myntra', { productType: 'clothing' }), 'Handwoven Ikat Dupatta');
  });
  it("keeps food's brand (D-139) and never empties a name", () => {
    assert.equal(cleanTitle("Haldiram's Aloo Bhujia", { brand: "Haldiram's", productType: 'food' }), "Haldiram's Aloo Bhujia");
    assert.equal(cleanTitle('Women', { productType: 'clothing' }), 'Women');
    assert.equal(cleanTitle('Libas', { brand: 'Libas', productType: 'clothing' }), 'Libas');
    assert.equal(startsWithBrand('TWINS LADY Kurta', 'twins lady'), true);
    assert.equal(startsWithBrand('Embroidered Kurta', 'TWINS LADY'), false);
  });
});

describe('brands among old names (D-140, L1)', async () => {
  const { guessBrands } = await import('../src/sourcing');
  it('finds a start shared by three names, or a leading all-capital name, never a garment word', () => {
    const b = guessBrands([
      'House of Pataudi Embroidered Kurta',
      'House of Pataudi Printed Kurta',
      'House of Pataudi Silk Sherwani',
      'TWINS LADY Women Kurta with Trousers',
      'Embroidered Kurta',
      'Embroidered Saree',
      'Embroidered Dupatta',
      'Aaliya Halterneck Kurti',
    ]);
    assert.deepEqual(b.sort(), ['house of pataudi', 'twins lady']);
  });
  it('never takes counts, materials or product words for a brand (one marketplace, many makers)', () => {
    const b = guessBrands([
      '3 in 1 Incense Sticks for Pooja',
      '3 in 1 Dhoop Cones, Pack of 2',
      '3 in 1 Agarbatti Stand',
      '100% Pure Brass Urli Bowl',
      '100% Pure Brass Diya',
      '100% Pure Copper Kalash',
      'Pure Brass Kuber Diya',
      'Pure Brass Akhand Jyot',
      'Pure Brass Pooja Thali',
      'Handmade Terracotta Diya',
      'Handmade Terracotta Urli',
      'Handmade Terracotta Lamp',
      'Peacock Wall Hanging',
      'Peacock Brass Diya',
      'Peacock Urli Bowl',
      'Big Peacock Brass Diya',
      'Brass Peacock Urli',
      'Ekhasa Brass Kuber Diya',
      'Ekhasa Copper Lota',
      'Ekhasa Brass Bell',
      'LED DIYA Lights',
      'GOLD PLATED Jhumka',
    ]);
    assert.deepEqual(b.sort(), ['ekhasa']);
  });
});

describe("the shop's specs (D-140, L4)", async () => {
  const { specPairs, usableSummary } = await import('../src/domain');
  it('reads a run of "Key: value" as pairs, and leaves a plain sentence alone', () => {
    assert.deepEqual(specPairs('Composition: 100% Cotton Gauze Fit: Fitted at bust Technical Details: Lined, side zip'), [
      ['Composition', '100% Cotton Gauze'],
      ['Fit', 'Fitted at bust'],
      ['Technical Details', 'Lined, side zip'],
    ]);
    assert.equal(specPairs('A light cotton kurti for hot days.'), null);
  });
  it('drops a summary that is specs or the description again', () => {
    assert.equal(usableSummary('Composition: Cotton Fit: Regular', 'x'), null);
    assert.equal(usableSummary('Soft cotton, block printed', 'Soft cotton, block printed by hand in Bagru.'), null);
    assert.equal(usableSummary('Block printed by hand in Bagru', 'Composition: Cotton'), 'Block printed by hand in Bagru');
  });
});

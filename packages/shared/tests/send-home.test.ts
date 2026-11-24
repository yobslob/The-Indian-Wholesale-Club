import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  billOf,
  checkUpi,
  customerGiftStatus,
  formatInr,
  giftChipsCents,
  giftFitsOrder,
  giftInrPaise,
  giftLineOf,
  maskUpi,
  promisedRate,
  quoteCheckout,
  roundUpGiftCents,
  savingCents,
  upiNote,
  upiOf,
  upiPayLink,
  type ShippingSettings,
} from '../src/domain';

describe('Send home: the round-up (D-205, plan §2 rule 3)', () => {
  it('brings the bag to the next whole dollar ending in 9, at least $3', () => {
    assert.equal(roundUpGiftCents(8500), 400);
    assert.equal(roundUpGiftCents(8400), 500);
    assert.equal(roundUpGiftCents(8600), 300);
    assert.equal(roundUpGiftCents(8740), 1160);
    assert.equal(roundUpGiftCents(8900), 1000);
    assert.equal(roundUpGiftCents(650), 1250);
    assert.equal(roundUpGiftCents(0), 900);
  });

  it('offers the round-up, then $9 and $19 without repeating one', () => {
    assert.deepEqual(giftChipsCents(8500), [400, 900, 1900]);
    assert.deepEqual(giftChipsCents(8000), [900, 1900]);
  });

  it('never more than the order (D-206)', () => {
    assert.deepEqual(giftChipsCents(1500), [400, 900]);
    assert.deepEqual(giftChipsCents(650), []);
    assert.equal(giftFitsOrder(1500, 1500), true);
    assert.equal(giftFitsOrder(1501, 1500), false);
    assert.equal(giftFitsOrder(0, 1500), false);
  });
});

describe('Send home: the rupees (plan §2 rule 4, D-206)', () => {
  it("promises the day's rate less the 3% IWC keeps", () => {
    assert.equal(promisedRate(92, 3), 89.24);
    assert.equal(giftInrPaise(400, promisedRate(92, 3)), 35700);
    assert.equal(giftInrPaise(500, promisedRate(83.37, 3)), 40400);
    assert.equal(promisedRate(null, 3), null);
    assert.equal(promisedRate(92, 0), 92);
  });

  it('is dollars × the rate, rounded to the rupee; no rate, no gift', () => {
    assert.equal(giftInrPaise(400, 92), 36800);
    assert.equal(giftInrPaise(500, 92), 46000);
    assert.equal(giftInrPaise(1160, 92), 106700);
    assert.equal(giftInrPaise(399, 83.37), 33300);
    assert.equal(giftInrPaise(400, null), null);
    assert.equal(giftInrPaise(400, 0), null);
    assert.equal(formatInr(36800), '₹368');
    assert.equal(formatInr(294400), '₹2,944');
    assert.equal(formatInr(12345600), '₹1,23,456');
  });
});

describe('Send home: UPI (plan §4.2)', () => {
  it('takes a UPI ID or a 10-digit Indian mobile, normalised', () => {
    assert.deepEqual(upiOf(' Lakshmi.M@OKHDFC '), { kind: 'vpa', value: 'lakshmi.m@okhdfc' });
    assert.deepEqual(upiOf('+91 98470 12345'), { kind: 'mobile', value: '9847012345' });
    assert.deepEqual(upiOf('919847012345'), { kind: 'mobile', value: '9847012345' });
    assert.deepEqual(upiOf('09847012345'), { kind: 'mobile', value: '9847012345' });
    assert.equal(upiOf('5847012345'), null);
    assert.equal(upiOf('984701234'), null);
    assert.equal(upiOf('lakshmi@'), null);
    assert.equal(upiOf('@okhdfc'), null);
    assert.equal(upiOf('a b@okhdfc'), null);
  });

  it('checks a UPI ID as it is typed (D-206)', () => {
    assert.deepEqual(checkUpi(''), { kind: 'empty' });
    assert.deepEqual(checkUpi('lakshmi'), { kind: 'bad' });
    assert.deepEqual(checkUpi('98470 12345'), { kind: 'mobile' });
    assert.deepEqual(checkUpi('lakshmi.m@okhdfcbank'), { kind: 'known', app: 'Google Pay' });
    assert.deepEqual(checkUpi('papa@YBL'), { kind: 'known', app: 'PhonePe' });
    assert.deepEqual(checkUpi('papa@okhdfc'), { kind: 'unknown', handle: 'okhdfc' });
  });

  it('masks it for the customer', () => {
    assert.equal(maskUpi('9847012345'), '98470·····');
    assert.equal(maskUpi('lakshmi.m@okhdfc'), 'lak···@okhdfc');
  });

  it('writes the note Maa sees, at most 50 characters, and the desk link', () => {
    assert.equal(upiNote('Yogesh Kumar', 'Namaste Maa'), 'From Yogesh in USA. Namaste Maa');
    assert.equal(upiNote('', 'Hi'), 'From the USA. Hi');
    assert.ok(upiNote('Yogesh', 'x'.repeat(60)).length <= 50);
    assert.equal(giftLineOf('  Namaste   Maa 🙏 <3  '), 'Namaste Maa 3');
    assert.equal(giftLineOf('a'.repeat(40)).length, 30);
    assert.equal(
      upiPayLink({ upi: 'lakshmi.m@okhdfc', name: 'Maa', inrPaise: 36800, note: 'From Yogesh in USA. Namaste Maa' }),
      'upi://pay?pa=lakshmi.m%40okhdfc&pn=Maa&am=368.00&cu=INR&tn=From%20Yogesh%20in%20USA.%20Namaste%20Maa',
    );
    assert.equal(upiPayLink({ upi: '9847012345', name: 'Maa', inrPaise: 36800, note: '' }), null);
  });

  it('shows the customer three states', () => {
    assert.equal(customerGiftStatus('on_hold'), 'sending');
    assert.equal(customerGiftStatus('to_send'), 'sending');
    assert.equal(customerGiftStatus('sent'), 'sent');
    assert.equal(customerGiftStatus('failed'), 'refunded');
  });
});

describe('Send home beside the goods (plan §2 rule 2)', () => {
  const settings: ShippingSettings = {
    flatCents: 0,
    freeMinCents: 4999,
    bulkFromCents: 9999,
    smallOrder: { shippingCents: 799, retailerCents: 199 },
    bulkSaving: { pct: 10, capCents: 2500 },
  };
  const lines = (cents: number) => [{ unitPriceCents: cents, quantity: 1, taxable: true }];

  it('changes nothing but the total, and the total by exactly the gift', () => {
    for (const cents of [1000, 4998, 4999, 9998, 12000]) {
      for (const promo of [null, { discountType: 'fixed' as const, discountValue: 500, minOrderCents: 5000 }]) {
        const without = quoteCheckout(lines(cents), promo, settings, { ratePct: 6.625 }, 50)!;
        const withGift = quoteCheckout(lines(cents), promo, settings, { ratePct: 6.625 }, 50, 400)!;
        assert.equal('homeGiftCents' in without, false);
        const { homeGiftCents, ...rest } = withGift;
        assert.equal(homeGiftCents, 400);
        assert.deepEqual({ ...rest, totalCents: withGift.totalCents - 400 }, without);
      }
    }
  });

  it('a gift that would cross the free line or a coupon minimum does not count toward it', () => {
    const q = quoteCheckout(lines(4800), { discountType: 'fixed', discountValue: 500, minOrderCents: 5000 }, settings, null, 0, 1900)!;
    assert.equal(q.discountCents, 0);
    assert.ok(q.shippingCents > 0);
    assert.equal(q.taxCents, 0);
  });

  it('the bill draws it as its own line, outside the saving', () => {
    const q = quoteCheckout(lines(8500), null, settings, null, 0, 400)!;
    const bill = billOf(q, null, false);
    assert.equal(bill.homeGiftCents, 400);
    assert.equal(bill.totalCents, q.totalCents);
    assert.equal(bill.savingCents, billOf(quoteCheckout(lines(8500), null, settings)!, null, false).savingCents);
    assert.equal(billOf({ ...q, homeGiftCents: undefined }, null, false).homeGiftCents, 0);
  });

  it('refuses a gift that is not whole cents', () => {
    assert.throws(() => quoteCheckout(lines(1000), null, settings, null, 0, -1), RangeError);
    assert.throws(() => quoteCheckout(lines(1000), null, settings, null, 0, 1.5), RangeError);
  });
});

describe('the 5% saving (D-208)', () => {
  it('is the % of the goods, to the cent', () => {
    assert.equal(savingCents(8500, 5), 425);
    assert.equal(savingCents(8533, 5), 427);
    assert.equal(savingCents(1, 5), 0);
  });
  it('is nothing without a % or goods', () => {
    assert.equal(savingCents(8500, null), 0);
    assert.equal(savingCents(0, 5), 0);
  });
});

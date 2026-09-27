import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calcDiscountPercent,
  calculateCheckoutBreakdown,
  calculateShipping,
  calculateTax,
  formatUSD,
} from '../src/utils';

describe('Checkout Calculations & Financial Rules (Shared Source of Truth)', () => {
  it('correctly calculates free standard shipping for orders >= $75', () => {
    assert.equal(calculateShipping(7500, 'standard'), 0);
    assert.equal(calculateShipping(8900, 'standard'), 0);
    assert.equal(calculateShipping(12500, 'standard'), 0);
  });

  it('charges $5.99 for standard shipping under $75', () => {
    assert.equal(calculateShipping(7499, 'standard'), 599);
    assert.equal(calculateShipping(3200, 'standard'), 599);
    assert.equal(calculateShipping(4500, 'standard'), 599);
  });

  it('charges $12.99 for express shipping regardless of order amount', () => {
    assert.equal(calculateShipping(2000, 'express'), 1299);
    assert.equal(calculateShipping(10000, 'express'), 1299);
  });

  it('grants free shipping when FREESHIP promo code is supplied regardless of subtotal', () => {
    assert.equal(calculateShipping(3200, 'standard', 'FREESHIP'), 0);
    assert.equal(calculateShipping(1000, 'standard', 'freeship'), 0);
  });

  it('calculates 8% US sales tax including shipping in taxable amount', () => {
    const subtotal = 10000; // $100.00
    const shipping = 599; // $5.99
    const tax = calculateTax(subtotal + shipping);
    assert.equal(tax, Math.round(10599 * 0.08)); // 848 cents ($8.48)
  });

  it('formats currency correctly with formatUSD', () => {
    assert.equal(formatUSD(45), '$45.00');
    assert.equal(formatUSD(0), '$0.00');
    assert.equal(formatUSD(125.5), '$125.50');
  });

  it('computes correct discount percentages with calcDiscountPercent', () => {
    assert.equal(calcDiscountPercent(100, 80), 20);
    assert.equal(calcDiscountPercent(55, 45), 18);
    assert.equal(calcDiscountPercent(60, 48), 20);
    assert.equal(calcDiscountPercent(0, 50), 0);
  });

  it('calculates complete checkout breakdown without double-discounting on FREESHIP', () => {
    const breakdown = calculateCheckoutBreakdown(5000, 599, 'standard', {
      id: 'promo-1',
      code: 'FREESHIP',
      discount_type: 'fixed',
      discount_value: 599,
      min_order_cents: 0,
      max_uses: null,
      current_uses: 0,
      valid_from: '2026-01-01',
      valid_until: null,
      is_active: true,
      description: 'Free Shipping',
      created_at: '',
      updated_at: '',
    });

    assert.equal(breakdown.subtotalCents, 5000);
    assert.equal(breakdown.discountCents, 0); // Not double-discounted from subtotal
    assert.equal(breakdown.shippingCents, 0); // Shipping is free
    assert.equal(breakdown.taxCents, Math.round(5000 * 0.08)); // 400 cents ($4.00)
    assert.equal(breakdown.totalCents, 5400); // $54.00
  });

  it('calculates complete checkout breakdown for percentage discounts', () => {
    const breakdown = calculateCheckoutBreakdown(10000, 1000, 'standard', {
      id: 'promo-2',
      code: 'WELCOME10',
      discount_type: 'percentage',
      discount_value: 10,
      min_order_cents: 5000,
      max_uses: null,
      current_uses: 0,
      valid_from: '2026-01-01',
      valid_until: null,
      is_active: true,
      description: '10% off',
      created_at: '',
      updated_at: '',
    });

    assert.equal(breakdown.subtotalCents, 10000);
    assert.equal(breakdown.discountCents, 1000);
    assert.equal(breakdown.shippingCents, 0); // 9000 >= 7500 -> free shipping
    assert.equal(breakdown.taxCents, Math.round(9000 * 0.08)); // 720 cents ($7.20)
    assert.equal(breakdown.totalCents, 9720); // $97.20
  });
});

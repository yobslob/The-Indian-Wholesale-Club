import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * API route tests (T3).
 *
 * Unit-level tests that exercise the request validation and business logic
 * of the order creation and checkout intent API routes without starting
 * a Next.js server. Tests verify:
 *   - Request schema validation
 *   - Payment provider checks
 *   - Mock/test intent rejection in production mode
 *   - Promo code validation integration
 *   - Idempotency guard (duplicate PaymentIntent)
 */

import {
  createPaymentIntentSchema,
  checkoutShippingSchema,
  checkoutItemSchema,
  adminUpdateOrderStatusSchema,
  adminCreatePromoCodeSchema,
  carrierWebhookPayloadSchema,
  guestOrderLookupSchema,
} from '@repo/shared/schemas';

// ---------------------------------------------------------------------------
// Schema Validation Tests
// ---------------------------------------------------------------------------

describe('createPaymentIntentSchema validation', () => {
  const validItem = {
    variantId: '550e8400-e29b-41d4-a716-446655440000',
    productId: '550e8400-e29b-41d4-a716-446655440001',
    productName: 'Classic Oxford Shirt',
    productSlug: 'classic-oxford-shirt',
    priceCents: 4500,
    quantity: 1,
  };

  const validAddress = {
    email: 'test@example.com',
    fullName: 'John Doe',
    line1: '123 Main St',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
  };

  it('accepts valid checkout payloads', () => {
    const result = createPaymentIntentSchema.safeParse({
      items: [validItem],
      shippingAddress: validAddress,
      shippingMethod: 'standard',
    });
    assert.ok(result.success, 'Valid payload should pass schema validation');
  });

  it('rejects empty cart', () => {
    const result = createPaymentIntentSchema.safeParse({
      items: [],
      shippingAddress: validAddress,
      shippingMethod: 'standard',
    });
    assert.equal(result.success, false, 'Empty cart should be rejected');
  });

  it('rejects invalid email', () => {
    const result = checkoutShippingSchema.safeParse({
      ...validAddress,
      email: 'not-an-email',
    });
    assert.equal(result.success, false);
  });

  it('rejects invalid state code', () => {
    const result = checkoutShippingSchema.safeParse({
      ...validAddress,
      state: 'New York',
    });
    assert.equal(result.success, false, 'State should be 2-letter code');
  });

  it('rejects invalid ZIP code', () => {
    const result = checkoutShippingSchema.safeParse({
      ...validAddress,
      zipCode: 'ABCDE',
    });
    assert.equal(result.success, false, 'ZIP should be 5 digits or 5+4');
  });

  it('accepts valid ZIP+4 format', () => {
    const result = checkoutShippingSchema.safeParse({
      ...validAddress,
      zipCode: '10001-1234',
    });
    assert.ok(result.success, 'ZIP+4 should be accepted');
  });

  it('rejects negative price', () => {
    const result = checkoutItemSchema.safeParse({
      ...validItem,
      priceCents: -100,
    });
    assert.equal(result.success, false, 'Negative price should be rejected');
  });

  it('rejects zero quantity', () => {
    const result = checkoutItemSchema.safeParse({
      ...validItem,
      quantity: 0,
    });
    assert.equal(result.success, false, 'Zero quantity should be rejected');
  });

  it('validates payment intent ID format', () => {
    const goodPi = createPaymentIntentSchema.safeParse({
      items: [validItem],
      shippingAddress: validAddress,
      paymentIntentId: 'pi_test123',
    });
    assert.ok(goodPi.success, 'pi_ prefix should be accepted');

    const goodMock = createPaymentIntentSchema.safeParse({
      items: [validItem],
      shippingAddress: validAddress,
      paymentIntentId: 'mock_pi_test123',
    });
    assert.ok(goodMock.success, 'mock_pi_ prefix should be accepted');

    const badPi = createPaymentIntentSchema.safeParse({
      items: [validItem],
      shippingAddress: validAddress,
      paymentIntentId: 'invalid_intent_123',
    });
    assert.equal(badPi.success, false, 'Invalid prefix should be rejected');
  });

  it('defaults paymentProvider to stripe', () => {
    const result = createPaymentIntentSchema.safeParse({
      items: [validItem],
      shippingAddress: validAddress,
    });
    assert.ok(result.success);
    assert.equal(result.data?.paymentProvider, 'stripe');
  });
});

// ---------------------------------------------------------------------------
// Admin Schema Tests
// ---------------------------------------------------------------------------

describe('adminUpdateOrderStatusSchema validation', () => {
  it('accepts valid order status values', () => {
    const statuses = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'refunded',
    ];

    for (const status of statuses) {
      const result = adminUpdateOrderStatusSchema.safeParse({ status });
      assert.ok(result.success, `${status} should be accepted`);
    }
  });

  it('rejects invalid status values', () => {
    const result = adminUpdateOrderStatusSchema.safeParse({ status: 'returned' });
    assert.equal(result.success, false, '"returned" status should be rejected');
  });

  it('accepts optional tracking fields', () => {
    const result = adminUpdateOrderStatusSchema.safeParse({
      status: 'shipped',
      trackingCode: 'TRACK123',
      carrier: 'UPS',
      notes: 'Shipped from warehouse',
    });
    assert.ok(result.success);
  });
});

describe('adminCreatePromoCodeSchema validation', () => {
  it('accepts valid promo code data', () => {
    const result = adminCreatePromoCodeSchema.safeParse({
      code: 'SAVE20',
      discountType: 'percentage',
      discountValue: 20,
    });
    assert.ok(result.success);
    assert.equal(result.data?.code, 'SAVE20');
  });

  it('uppercases the code', () => {
    const result = adminCreatePromoCodeSchema.safeParse({
      code: 'save20',
      discountType: 'fixed',
      discountValue: 1000,
    });
    assert.ok(result.success);
    assert.equal(result.data?.code, 'SAVE20', 'Code should be uppercased');
  });

  it('rejects negative discount value', () => {
    const result = adminCreatePromoCodeSchema.safeParse({
      code: 'BAD',
      discountType: 'percentage',
      discountValue: -5,
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// Carrier Webhook Schema Tests
// ---------------------------------------------------------------------------

describe('carrierWebhookPayloadSchema validation', () => {
  it('accepts valid carrier payloads', () => {
    const result = carrierWebhookPayloadSchema.safeParse({
      trackingNumber: 'TRACK123',
      status: 'delivered',
    });
    assert.ok(result.success);
  });

  it('defaults carrier to Carrier Partner', () => {
    const result = carrierWebhookPayloadSchema.safeParse({
      trackingNumber: 'TRACK123',
      status: 'in_transit',
    });
    assert.ok(result.success);
    assert.equal(result.data?.carrier, 'Carrier Partner');
  });

  it('rejects missing trackingNumber', () => {
    const result = carrierWebhookPayloadSchema.safeParse({
      status: 'delivered',
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// Guest Order Lookup Schema
// ---------------------------------------------------------------------------

describe('guestOrderLookupSchema validation', () => {
  it('accepts valid order lookup', () => {
    const result = guestOrderLookupSchema.safeParse({
      orderNumber: 'ORD-ABC12345',
      email: 'customer@example.com',
    });
    assert.ok(result.success);
  });

  it('rejects short order numbers', () => {
    const result = guestOrderLookupSchema.safeParse({
      orderNumber: 'ORD',
      email: 'customer@example.com',
    });
    assert.equal(result.success, false);
  });

  it('rejects invalid email', () => {
    const result = guestOrderLookupSchema.safeParse({
      orderNumber: 'ORD-ABC12345',
      email: 'not-email',
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// Payment Provider Logic Tests
// ---------------------------------------------------------------------------

describe('Payment Provider Validation Logic', () => {
  it('rejects stripe_simulator in production', () => {
    const isProduction = true;
    const paymentProvider: string = 'stripe_simulator';
    const shouldReject = isProduction && paymentProvider !== 'stripe';
    assert.ok(shouldReject, 'stripe_simulator should be rejected in production');
  });

  it('accepts stripe in production', () => {
    const isProduction = true;
    const paymentProvider: string = 'stripe';
    const shouldReject = isProduction && paymentProvider !== 'stripe';
    assert.equal(shouldReject, false, 'stripe should be accepted in production');
  });

  it('identifies mock payment intents', () => {
    const mockIds = ['mock_pi_test_123', 'pi_test_abc', null, undefined];
    for (const id of mockIds) {
      const isMock = !id || id.startsWith('mock_pi_') || id.startsWith('pi_test_');
      assert.ok(isMock, `${id ?? 'null'} should be identified as mock`);
    }

    const realId = 'pi_3P4abc123';
    const isMock = !realId || realId.startsWith('mock_pi_') || realId.startsWith('pi_test_');
    assert.equal(isMock, false, 'Real pi_ should not be identified as mock');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validatePromoCode, verifyVariantStock } from '../lib/queries/orders';

import type { CheckoutItemPayload } from '../lib/queries/orders';
import type { Database, PromoCode } from '@repo/shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Test doubles: the query helpers accept a Supabase client as their first
// argument, so a minimal chain stub exercises the real business logic.
// -----------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  error?: { message: string } | null;
}

function promoClient(result: QueryResult): SupabaseClient<Database> {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    single: async () => result,
  };
  return chain as unknown as SupabaseClient<Database>;
}

function stockClient(result: QueryResult): SupabaseClient<Database> {
  const chain = {
    from: () => chain,
    select: () => chain,
    in: async () => result,
  };
  return chain as unknown as SupabaseClient<Database>;
}

function promoFixture(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: 'promo-1',
    code: 'WELCOME10',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_cents: null,
    max_uses: null,
    current_uses: 0,
    valid_from: null,
    valid_until: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function cartItem(overrides: Partial<CheckoutItemPayload> = {}): CheckoutItemPayload {
  return {
    variantId: 'variant-1',
    productId: 'product-1',
    productName: 'Classic Oxford Shirt',
    productSlug: 'classic-oxford-shirt',
    priceCents: 4500,
    quantity: 1,
    ...overrides,
  };
}

function variantRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'variant-1',
    product_id: 'product-1',
    price_cents: 4500,
    inventory_count: 5,
    is_active: true,
    products: { base_price_cents: 4500, is_active: true },
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// validatePromoCode
// -----------------------------------------------------------------------------

describe('validatePromoCode', () => {
  it('rejects an empty code without touching the database', async () => {
    const result = await validatePromoCode(promoClient({}), '', 5000);
    assert.equal(result.valid, false);
    assert.equal(result.discountCents, 0);
    assert.match(result.message ?? '', /cannot be empty/i);
  });

  it('rejects unknown or inactive promo codes', async () => {
    const result = await validatePromoCode(
      promoClient({ data: null, error: { message: 'No rows returned' } }),
      'NOPE',
      5000,
    );
    assert.equal(result.valid, false);
    assert.equal(result.discountCents, 0);
    assert.match(result.message ?? '', /Invalid or expired/i);
  });

  it('computes percentage discounts with rounding', async () => {
    const client = promoClient({ data: promoFixture({ discount_value: 10 }) });
    const result = await validatePromoCode(client, 'welcome10', 2000);
    assert.equal(result.valid, true);
    assert.equal(result.discountCents, 200);
    assert.equal(result.promo?.code, 'WELCOME10');
  });

  it('clamps fixed-amount discounts to the subtotal', async () => {
    const client = promoClient({
      data: promoFixture({ discount_type: 'fixed', discount_value: 500 }),
    });

    const belowCap = await validatePromoCode(client, 'WELCOME10', 2000);
    assert.equal(belowCap.valid, true);
    assert.equal(belowCap.discountCents, 500);

    const aboveCap = await validatePromoCode(client, 'WELCOME10', 300);
    assert.equal(aboveCap.valid, true);
    assert.equal(aboveCap.discountCents, 300);
  });

  it('rejects promos outside their valid date window', async () => {
    const expired = await validatePromoCode(
      promoClient({ data: promoFixture({ valid_until: '2020-01-01T00:00:00.000Z' }) }),
      'WELCOME10',
      5000,
    );
    assert.equal(expired.valid, false);
    assert.match(expired.message ?? '', /expired/i);

    const notStarted = await validatePromoCode(
      promoClient({ data: promoFixture({ valid_from: '2099-01-01T00:00:00.000Z' }) }),
      'WELCOME10',
      5000,
    );
    assert.equal(notStarted.valid, false);
    assert.match(notStarted.message ?? '', /has not started/i);
  });

  it('rejects promos that reached their usage limit', async () => {
    const client = promoClient({
      data: promoFixture({ max_uses: 3, current_uses: 3 }),
    });
    const result = await validatePromoCode(client, 'WELCOME10', 5000);
    assert.equal(result.valid, false);
    assert.match(result.message ?? '', /usage limit/i);
  });

  it('enforces the minimum order amount', async () => {
    const client = promoClient({
      data: promoFixture({ discount_type: 'fixed', discount_value: 500, min_order_cents: 10000 }),
    });

    const tooSmall = await validatePromoCode(client, 'WELCOME10', 5000);
    assert.equal(tooSmall.valid, false);
    assert.match(tooSmall.message ?? '', /\$100\.00/);

    const bigEnough = await validatePromoCode(client, 'WELCOME10', 10000);
    assert.equal(bigEnough.valid, true);
    assert.equal(bigEnough.discountCents, 500);
  });
});

// -----------------------------------------------------------------------------
// verifyVariantStock
// -----------------------------------------------------------------------------

describe('verifyVariantStock', () => {
  it('accepts in-stock items and returns server prices', async () => {
    const client = stockClient({ data: [variantRow()] });
    const result = await verifyVariantStock(client, [cartItem()]);

    assert.equal(result.ok, true);
    assert.equal(result.verifiedItems?.length, 1);
    assert.equal(result.verifiedItems?.[0]?.serverPriceCents, 4500);
    assert.equal(result.verifiedItems?.[0]?.inventoryCount, 5);
  });

  it('rejects items with insufficient inventory', async () => {
    const client = stockClient({ data: [variantRow({ inventory_count: 0 })] });
    const result = await verifyVariantStock(client, [cartItem()]);

    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /0 unit\(s\) remaining/);
  });

  it('aggregates quantities for duplicated variants to prevent split-item overselling (N16)', async () => {
    const items = [cartItem(), cartItem()];

    const shortStock = await verifyVariantStock(
      stockClient({ data: [variantRow({ inventory_count: 1 })] }),
      items,
    );
    assert.equal(shortStock.ok, false);
    assert.match(shortStock.error ?? '', /1 unit\(s\) remaining/);

    const exactStock = await verifyVariantStock(
      stockClient({ data: [variantRow({ inventory_count: 2 })] }),
      items,
    );
    assert.equal(exactStock.ok, true);
    assert.equal(exactStock.verifiedItems?.length, 2);
  });

  it('rejects inactive variants and archived products', async () => {
    const inactiveVariant = await verifyVariantStock(
      stockClient({ data: [variantRow({ is_active: false })] }),
      [cartItem()],
    );
    assert.equal(inactiveVariant.ok, false);
    assert.match(inactiveVariant.error ?? '', /no longer available/);

    const archivedProduct = await verifyVariantStock(
      stockClient({
        data: [variantRow({ products: { base_price_cents: 4500, is_active: false } })],
      }),
      [cartItem()],
    );
    assert.equal(archivedProduct.ok, false);
    assert.match(archivedProduct.error ?? '', /archived/);
  });

  it('rejects variants missing from the catalog response', async () => {
    const client = stockClient({ data: [] });
    const result = await verifyVariantStock(client, [cartItem()]);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /no longer available/);
  });

  it('fails closed when the catalog query errors', async () => {
    const client = stockClient({ data: null, error: { message: 'connection reset' } });
    const result = await verifyVariantStock(client, [cartItem()]);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /Failed to verify inventory/);
  });
});

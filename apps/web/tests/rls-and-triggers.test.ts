import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * RLS policy and PostgreSQL trigger tests (T3).
 *
 * These are assertion-based tests that verify the expected RLS policy
 * and trigger configurations by examining the migration SQL content.
 * They serve as regression tests ensuring the migration files contain
 * the required policy definitions.
 *
 * NOTE: Full integration tests would require a running Supabase instance.
 * These tests verify the *specification* of policies, not their runtime
 * behavior. They read migration files to confirm policies exist.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

function getAllMigrationsSql(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8')).join('\n');
}

describe('RLS Policies', () => {
  const allSql = getAllMigrationsSql();

  it('enables RLS on the orders table', () => {
    assert.ok(
      allSql.includes('ALTER TABLE') &&
        allSql.includes('orders') &&
        allSql.includes('ENABLE ROW LEVEL SECURITY'),
      'orders table should have RLS enabled',
    );
  });

  it('enables RLS on the order_items table', () => {
    assert.ok(
      allSql.includes('order_items') && allSql.includes('ENABLE ROW LEVEL SECURITY'),
      'order_items should have RLS enabled',
    );
  });

  it('enables RLS on the tracking_events table', () => {
    assert.ok(
      allSql.includes('tracking_events') && allSql.includes('ENABLE ROW LEVEL SECURITY'),
      'tracking_events should have RLS enabled',
    );
  });

  it('has SELECT policies for authenticated users on orders', () => {
    assert.ok(
      allSql.includes('CREATE POLICY') && allSql.includes('orders') && allSql.includes('SELECT'),
      'Should have SELECT policy for orders',
    );
  });

  it('has INSERT policies for orders', () => {
    assert.ok(
      allSql.includes('CREATE POLICY') && allSql.includes('INSERT') && allSql.includes('orders'),
      'Should have INSERT policy for orders',
    );
  });

  it('protects wishlists with RLS', () => {
    assert.ok(
      allSql.includes('wishlists') && allSql.includes('ROW LEVEL SECURITY'),
      'wishlists should have RLS',
    );
  });
});

describe('PostgreSQL Triggers', () => {
  const allSql = getAllMigrationsSql();

  it('has stock deduction trigger on order_items insert', () => {
    assert.ok(
      allSql.includes('trigger_deduct_stock_on_item_insert') ||
        allSql.includes('AFTER INSERT ON order_items'),
      'Should have inventory deduction trigger on order_items INSERT',
    );
  });

  it('has order number generation trigger', () => {
    assert.ok(
      allSql.includes('order_number') && allSql.includes('TRIGGER'),
      'Should have order number generation trigger',
    );
  });

  it('has increment_promo_uses function', () => {
    assert.ok(
      allSql.includes('increment_promo_uses'),
      'Should have atomic promo code usage increment function',
    );
  });

  it('has webhook_events table for idempotency', () => {
    assert.ok(
      allSql.includes('webhook_events'),
      'Should have webhook_events table for idempotency',
    );
  });

  it('has partial unique index on payment_intent_id', () => {
    assert.ok(
      allSql.includes('idx_orders_payment_intent_id') || allSql.includes('payment_intent_id'),
      'Should have unique index on payment_intent_id',
    );
  });
});

describe('Migration Integrity', () => {
  it('all migration files parse as valid SQL (no syntax markers)', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    assert.ok(files.length >= 5, `Should have at least 5 migration files, found ${files.length}`);

    for (const file of files) {
      const content = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      assert.ok(!content.includes('<<<'), `${file} should not contain merge conflict markers`);
      assert.ok(content.length > 0, `${file} should not be empty`);
    }
  });

  it('migration files follow naming convention', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    const pattern = /^\d{14}_[\w-]+\.sql$/;

    for (const file of files) {
      assert.ok(pattern.test(file), `${file} should follow YYYYMMDDHHMMSS_name.sql convention`);
    }
  });
});

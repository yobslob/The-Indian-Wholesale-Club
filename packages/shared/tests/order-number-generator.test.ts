import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

/**
 * The order number generator is a Postgres BEFORE INSERT trigger
 * (supabase/migrations/20260926000002_order_number_entropy.sql).
 * Without a live database these tests pin down the migration contract:
 * format, entropy source, and that the weak md5 variant is not reintroduced.
 */

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260926000002_order_number_entropy.sql',
);

const ORDER_NUMBER_FORMAT = /^ORD-\d{8}-[0-9A-F]{10}$/;

describe('generate_order_number() migration contract (C2/Batch B)', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');

  it('uses gen_random_uuid() as the randomness source', () => {
    assert.ok(sql.includes('gen_random_uuid()'), 'must derive entropy from gen_random_uuid()');
    assert.ok(
      !sql.includes('md5(random()'),
      'legacy md5(random()) entropy must not reappear in the current generator',
    );
  });

  it('keeps 10 hex characters of entropy (40 bits)', () => {
    assert.match(sql, /from 1 for 10/);
    assert.match(sql, /replace\(gen_random_uuid\(\)::text, '-', ''\)/);
  });

  it('keeps the ORD-YYYYMMDD- prefix contract', () => {
    assert.ok(sql.includes(`'ORD-' || to_char(NOW(), 'YYYYMMDD')`));
  });

  it('documents the expected order number format', () => {
    assert.match(sql, /ORD-YYYYMMDD-<10 hex chars>/);
    // Example numbers in the documented format must validate:
    assert.match('ORD-20260926-A1B2C3D4E5', ORDER_NUMBER_FORMAT);
    assert.ok(!ORDER_NUMBER_FORMAT.test('ORD-20260926-A1B2'), 'short suffix must not match');
    assert.ok(!ORDER_NUMBER_FORMAT.test('ORD-20260926-a1b2c3d4e5'), 'suffix must be uppercase');
  });
});

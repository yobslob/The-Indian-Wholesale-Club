#!/usr/bin/env node
/**
 * scripts/db-test.mjs: runs the DB invariant tests (supabase/tests/*.test.sql).
 *
 * Expects a database that already has the migrations + seeds applied, i.e. local
 * Supabase after `npx supabase db reset` (check.mjs `db` step does both).
 * Every test file runs inside its own transaction and rolls back; the helper
 * schema `tests` is dropped at the end, so the database is left unchanged.
 *
 * Usage:  node scripts/db-test.mjs [--url=postgresql://…]
 * Default URL = local Supabase. Refuses non-local hosts unless --allow-remote.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';

const args = process.argv.slice(2);
const urlArg = args.find((a) => a.startsWith('--url='));
const url =
  (urlArg && urlArg.slice(6)) ||
  process.env.SUPABASE_TEST_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !args.includes('--allow-remote')) {
  console.error(`Refusing to run tests against non-local host "${host}". Use --allow-remote to override.`);
  process.exit(2);
}

const dir = join('supabase', 'tests');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.sql'))
  .sort();

const client = new pg.Client({ connectionString: url });
await client.connect();

let failed = 0;
try {
  await client.query(readFileSync(join(dir, '_helpers.sql'), 'utf8'));
  for (const file of files) {
    const sql = readFileSync(join(dir, file), 'utf8');
    const assertions = (sql.match(/tests\.assert/g) ?? []).length;
    try {
      await client.query(sql);
      console.log(`PASS  ${file} (${assertions} assertions)`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${file}\n      ${err instanceof Error ? err.message : String(err)}`);
      await client.query('rollback').catch(() => {});
    }
  }
} finally {
  await client.query('drop schema if exists tests cascade').catch(() => {});
  await client.end();
}

console.log(`== ${files.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

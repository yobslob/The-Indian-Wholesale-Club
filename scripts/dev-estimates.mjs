#!/usr/bin/env node
/**
 * scripts/dev-estimates.mjs: loads Claude's researched pricing ESTIMATES (supabase/seed/estimates.sql, D-047) into the
 * LOCAL database without a reset. Only empty settings are filled; each is labelled as an estimate with its source.
 *
 * Usage:  pnpm dev:estimates
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const url = process.env.SUPABASE_TEST_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname)) {
  console.error('Refusing to load estimates into a non-local database (use the SQL editor for the hosted dev one).');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin');
  await client.query(readFileSync('supabase/seed/estimates.sql', 'utf8'));
  await client.query('commit');
  const { rows } = await client.query(
    'select setting, checked_on from public.pricing_estimates order by setting',
  );
  console.log(rows.length ? rows.map((r) => `estimate: ${r.setting}`).join('\n') : 'no estimates (every setting is set)');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}

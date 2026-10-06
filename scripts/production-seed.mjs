#!/usr/bin/env node
/**
 * scripts/production-seed.mjs: the ONE-TIME data a new production database needs after its migrations (the Deploy
 * workflow pushes migrations, never seeds): the 36 regions (D-002, their text as drafts, D-019), the category tree,
 * and the pilot's high-end numbers (D-069, each labelled as a placeholder in Settings until the founder saves their own).
 * Never the demo data or the placeholder catalogue.
 *
 * The founder runs it (Claude never touches a hosted database):
 *   pnpm prod:seed --url=postgresql://… --allow-remote            # dry run: says what it would load
 *   pnpm prod:seed --url=postgresql://… --allow-remote --apply    # loads it, all or nothing
 * It refuses a database that already has regions, so a second run changes nothing.
 */
import { readFileSync } from 'node:fs';

import pg from 'pg';

const FILES = ['supabase/seed/regions.sql', 'supabase/seed/categories.sql', 'supabase/seed/estimates.sql'];

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('--url='))?.slice(6);
if (!url) {
  console.error('Pass the production database URL: --url=postgresql://… (Supabase → Project settings → Database).');
  process.exit(2);
}
const local = ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname);
if (!local && !args.includes('--allow-remote')) {
  console.error('Refusing a non-local database without --allow-remote.');
  process.exit(2);
}
const apply = args.includes('--apply');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows: tables } = await client.query("select to_regclass('public.regions') is not null as ready");
  if (!tables[0].ready) {
    console.error('This database has no IWC schema yet: run the Deploy workflow (migrations) first.');
    process.exit(1);
  }
  const { rows } = await client.query('select count(*)::int as n from public.regions');
  if (rows[0].n > 0) {
    console.error(`This database already has ${rows[0].n} regions: nothing to do (this script runs once).`);
    process.exit(1);
  }
  if (!apply) {
    console.log(`Dry run. With --apply this loads, in one transaction:\n${FILES.map((f) => `  ${f}`).join('\n')}`);
    process.exit(0);
  }
  await client.query('begin');
  for (const file of FILES) {
    await client.query(readFileSync(file, 'utf8'));
    console.log(`loaded ${file}`);
  }
  await client.query('commit');
  const counts = await client.query(
    'select (select count(*) from public.regions)::int as regions, (select count(*) from public.categories)::int as categories, (select count(*) from public.pricing_estimates)::int as estimates',
  );
  const c = counts.rows[0];
  console.log(`Done: ${c.regions} regions, ${c.categories} categories, ${c.estimates} pilot numbers (placeholders).`);
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(`Nothing was loaded: ${error.message}`);
  process.exit(1);
} finally {
  await client.end();
}

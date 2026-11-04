#!/usr/bin/env node
/**
 * scripts/launch-check.mjs: everything that still stands between the site and going live (C8). READ-ONLY: it runs its
 * queries in a read-only transaction and changes nothing. Exit code 1 while anything blocks the launch.
 *
 * Usage:
 *   pnpm launch:check                                  # the local database (a dry run of the checks)
 *   pnpm launch:check --url=postgresql://…  --allow-remote   # the production database, before going live
 *
 * Checks the database (every setting D-069 and the delivery and free-shipping numbers D-187, sales tax D-073, the
 * business details D-074, placeholder and demo data, region text approval D-019, the timers and the email sender's
 * Vault settings) and the repo (open launch questions, TODO(founder) markers on customer pages).
 * Environment variables are checked by the deploy itself (docs/ops.md).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import pg from 'pg';

const args = process.argv.slice(2);
const url =
  args.find((a) => a.startsWith('--url='))?.slice(6) ||
  process.env.SUPABASE_TEST_DB_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname) && !args.includes('--allow-remote')) {
  console.error('Refusing a non-local database without --allow-remote (the check only reads).');
  process.exit(2);
}

/** @type {{ ok: boolean, label: string, detail?: string }[]} */
const results = [];
const check = (ok, label, detail) => results.push({ ok, label, detail });

// ------------------------------------------------------------------ the database
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('begin transaction read only');
  const one = async (sql) => (await client.query(sql)).rows[0];
  const all = async (sql) => (await client.query(sql)).rows;

  const s = await one('select * from public.pricing_settings where id = 1');
  const unset = ['food_delivery_days_min', 'food_delivery_days_max', 'delivery_days_min', 'delivery_days_max',
    'free_shipping_min_cents', 'bulk_saving_from_cents',
    'domestic_days_min', 'domestic_days_max', 'shipping_flat_cents', 'stale_listing_days',
    'export_cancel_deduction_pct', 'return_claim_days', 'return_tier1_days', 'return_tier1_pct', 'return_tier2_days',
    'return_tier2_pct', 'return_tier3_days', 'return_tier3_pct', 'clearance_discount_pct'].filter((k) => s[k] === null);
  check(unset.length === 0, 'Every delivery, shipping and after-sale setting is set (D-069, D-187)', unset.join(', '));
  const tax = await one('select count(*)::int as n from public.tax_rates');
  check(tax.n > 0, 'Sales tax is set up for the states where IWC is registered (D-073)', 'no tax_rates row');
  const details = await all('select label from public.business_details where is_placeholder order by group_name, sort_order');
  check(details.length === 0, 'The business and compliance details are filled in (D-074, Settings)',
    details.map((d) => d.label).join(', '));

  const placeholders = await one(
    "select count(*)::int as n from public.products where is_placeholder and status = 'live'",
  );
  check(placeholders.n === 0, 'No placeholder product is live (INV-8)', `${placeholders.n} live placeholder products`);
  const demo = await one("select count(*)::int as n from public.product_variants where sku like 'DEMO-%'");
  check(demo.n === 0, 'No demo data (seed/demo.sql) in this database', `${demo.n} demo variants`);
  const preview = await one("select coalesce((select value::text from public.app_settings where key = 'dev_preview'), 'false') as v");
  check(preview.v === 'false', 'The dev preview is off (placeholders hidden)', `dev_preview = ${preview.v}`);

  const regions = await all(
    "select name from public.regions where is_live and content_status <> 'approved' order by name",
  );
  check(regions.length === 0, 'Every live state\'s text is approved (D-019)', regions.map((r) => r.name).join(', '));
  const liveRegions = await one('select count(*)::int as n from public.regions where is_live');
  check(liveRegions.n > 0, 'At least one state is live', 'no live state');

  const cron = await one(
    "select to_regclass('cron.job') is not null as present",
  );
  const jobs = cron.present
    ? (await all("select jobname from cron.job where jobname in ('iwc-email-outbox', 'iwc-tidy')")).map((j) => j.jobname)
    : [];
  check(jobs.includes('iwc-email-outbox'), 'The email outbox is sent every minute (pg_cron job)', 'iwc-email-outbox missing');
  check(jobs.includes('iwc-tidy'), 'Old logs are cleared every day (pg_cron job, D-187)', 'iwc-tidy missing');
  const vault = await one(
    "select to_regclass('vault.secrets') is not null as present",
  );
  const secrets = vault.present
    ? (await all("select name from vault.secrets where name in ('iwc_site_url', 'iwc_outbox_secret')")).map((r) => r.name)
    : [];
  check(secrets.length === 2, 'The email timer knows the site URL and its secret (Vault, ops.md)',
    `missing: ${['iwc_site_url', 'iwc_outbox_secret'].filter((n) => !secrets.includes(n)).join(', ')}`);

  const stuck = await one(
    "select count(*)::int as n from public.email_outbox where status = 'dead_letter' or (status = 'pending' and created_at < now() - interval '1 hour')",
  );
  check(stuck.n === 0, 'No customer email is stuck in the outbox', `${stuck.n} emails waiting over an hour or given up`);
  await client.query('rollback');
} finally {
  await client.end();
}

// ------------------------------------------------------------------ the repo
const questions = readFileSync('docs/questions.md', 'utf8');
const LAUNCH_QUESTIONS = ['Q-9'];
const blocking = LAUNCH_QUESTIONS.filter((q) => new RegExp(`^\\| ${q} \\|`, 'm').test(questions));
check(blocking.length === 0, `The launch questions are answered (${LAUNCH_QUESTIONS.join(', ')})`, `open: ${blocking.join(', ')}`);

const todos = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|md)$/.test(name) && readFileSync(path, 'utf8').includes('TODO(founder)')) todos.push(path);
  }
};
walk(join('apps', 'web', 'app', '(store)'));
check(todos.length === 0, 'Customer pages carry no TODO(founder) markers (policy and info pages)',
  todos.map((t) => t.replace(/\\/g, '/').replace('apps/web/app/(store)/', '')).join(', '));

// ------------------------------------------------------------------ report
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'TODO'}  ${r.label}${r.ok || !r.detail ? '' : `\n        ${r.detail}`}`);
}
console.log(`\n${failed.length === 0 ? 'Ready to launch.' : `${failed.length} of ${results.length} still to do before launch.`}`);
process.exit(failed.length === 0 ? 0 : 1);

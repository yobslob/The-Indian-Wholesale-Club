#!/usr/bin/env node
/**
 * scripts/quick-sources.mjs (D-162): the listings that can be bought whole from the quick-delivery shops (Blinkit,
 * BigBasket, Zepto, Instamart) but are bought from a cheaper Amazon or Flipkart backup today, so they lack the 7-day
 * tag. Since migration 20261101090000 new and re-checked listings are bought there by themselves; this switches the
 * ones settled before it, as the weekly check would (from the prices last read; each listing's check date kept).
 * Read-only unless --apply; batches of --batch listings (default 100), each one database call, until none is left.
 *
 *   pnpm quick:sources -- --env=<file> [--allow-remote]            what it would switch (nothing written)
 *   pnpm quick:sources -- --env=<file> --apply [--allow-remote]    switch them
 *
 * --env: a file with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (default apps/web/.env.local, usually the
 * local database). The hosted database needs the migration first (the Deploy workflow).
 */
import { existsSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const envFile = flag('env') ?? 'apps/web/.env.local';
if (!existsSync(envFile)) throw new Error(`No ${envFile}`);
process.loadEnvFile(envFile);
const apply = args.includes('--apply');
const batch = Number(flag('batch') ?? 100);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const host = URL.canParse(url) ? new URL(url).hostname : '';
const local = ['127.0.0.1', 'localhost'].includes(host);
if (!host || !key) throw new Error(`${envFile}: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY`);
console.log(`Database: ${host} (${local ? 'local' : 'HOSTED'})${apply ? '' : ' — dry run, nothing is written'}`);
if (!local && !args.includes('--allow-remote')) {
  console.error('A hosted database: add --allow-remote to go ahead.');
  process.exit(2);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const rupees = (paise) => (paise == null ? '—' : `₹${(paise / 100).toLocaleString('en-IN')}`);

async function call(applyNow) {
  const { data, error } = await db.rpc('ops_quick_sources', { p_apply: applyNow, p_limit: batch });
  if (error) {
    if (/ops_quick_sources/.test(error.message)) console.error('The migration 20261101090000_quick_sources is not applied here yet (run the Deploy workflow first).');
    throw new Error(error.message);
  }
  return data;
}

function report(r) {
  console.log(`To switch to the quick shops: ${r.to_switch} listings (${r.live_to_switch} live).`);
  console.log(`Staying as they are: ${r.stay_normal} (an option has no usable quick-shop source: sold out, held or not found there).`);
  for (const s of r.sample)
    console.log(`  ${s.status.padEnd(5)} ${s.name.slice(0, 60).padEnd(60)} ${String(s.bought_at).padEnd(24)} ${rupees(s.shop_price_paise)} → ${rupees(s.quick_price_paise)}`);
  if (r.unmarked_sites.length)
    console.log(`Sites that look like a quick shop but are not marked as one (not changed): ${r.unmarked_sites.join(', ')}`);
}

let r = await call(false);
report(r);
if (!apply) {
  console.log(r.to_switch ? '\nNothing written. Run again with --apply to switch them.' : '\nNothing to do.');
  process.exit(0);
}
let switched = 0;
while (r.to_switch > 0) {
  const before = r.to_switch;
  r = await call(true);
  switched += r.switched;
  console.log(`Switched ${switched}; ${r.to_switch} left.`);
  if (r.switched === 0 || r.to_switch >= before) break;
}
console.log(`Done: ${switched} listings now bought from the quick shops. Store pages show their 7-day tag within 5 minutes.`);

#!/usr/bin/env node
/**
 * scripts/master-catalogue.mjs: replaces the whole inventory with the master catalogue (D-106 – D-108).
 *
 *   pnpm catalogue:master --url=<postgres URL> --api=<https://<ref>.supabase.co> --service-key=<service role key> [--allow-remote] [--apply]
 *
 * In one transaction: every product goes, with its sizes, photos and reviews, every order that contains one (demo
 * orders, Stripe test mode), the placeholder shops, the demo reviewer accounts and the demo state photos; then
 * catalogue/master/products.csv goes in as placeholder listings (is_placeholder, D-012) from one placeholder shop per
 * state, every state is live, spices are cleared (D-107) and demo mode is on (D-078). Settings, cycles and real shops
 * stay. Without --apply it rolls back and only reports. `pnpm demo:clear` removes the placeholders again.
 */
import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { toListings } from './lib/master-map.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes('--apply');
for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const dbUrl = flag('url') ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const local = (u) => ['127.0.0.1', 'localhost', '::1'].includes(new URL(u).hostname);
const api = flag('api') ?? (local(dbUrl) ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);
const serviceKey = flag('service-key') ?? (local(dbUrl) ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
if (!api || !serviceKey) {
  console.error('Pass --api=<https://<ref>.supabase.co> and --service-key=<service role key> (to remove the stored photos).');
  process.exit(2);
}
if ((!local(dbUrl) || !local(api)) && !args.includes('--allow-remote')) {
  console.error('Refusing a non-local database without --allow-remote.');
  process.exit(2);
}

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and line breaks. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), (i += 1);
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(field), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((f) => f.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^﻿/, '').trim(), r[i] ?? ''])));
}

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const db = createClient(api, serviceKey, { auth: { persistSession: false } });
let paths = [];
try {
  const regions = (await client.query('select slug from public.regions')).rows.map((r) => r.slug);
  const { listings, problems } = toListings(parseCsv(readFileSync(flag('csv') ?? 'catalogue/master/products.csv', 'utf8')), new Set(regions));
  if (problems.length) throw new Error(`The file has rows that cannot be placed:\n- ${[...new Set(problems)].join('\n- ')}`);

  await client.query('begin');
  // 1. Clear everything listed (D-108).
  await client.query(`
    create temporary table gone_products on commit drop as select id from public.products;
    create temporary table gone_orders on commit drop as
      select distinct o.id, o.order_number from public.orders o join public.order_items i on i.order_id = o.id
      left join public.product_variants v on v.id = i.variant_id
      where i.product_id in (select id from gone_products) or v.product_id in (select id from gone_products);`);
  const count = async (sql) => (await client.query(sql)).rows[0].n;
  const removed = {
    products: await count('select count(*)::int as n from gone_products'),
    'orders (with their lines, events, pickups and returns)': await count('select count(*)::int as n from gone_orders'),
    reviews: await count('select count(*)::int as n from public.reviews'),
    'demo reviewer accounts': await count(`select count(*)::int as n from auth.users where email like 'demo-reviewer-%@iwc-demo.invalid'`),
  };
  paths = [
    ...(await client.query('select storage_path from public.product_media')).rows,
    ...(await client.query(`select hero_image_path as storage_path from public.regions where hero_image_path like 'regions/%/demo-%'`)).rows,
    ...(await client.query(`select storage_path from public.region_photos where storage_path like 'regions/%/album/demo-%'`)).rows,
  ].map((r) => r.storage_path);
  await client.query(`
    delete from public.email_outbox where payload ->> 'orderNumber' in (select order_number from gone_orders);
    delete from public.pickups where variant_id in (select v.id from public.product_variants v where v.product_id in (select id from gone_products));
    delete from public.orders where id in (select id from gone_orders);
    delete from public.products where id in (select id from gone_products);
    delete from public.vendor_payouts where vendor_id in (select id from public.vendors where is_placeholder);
    delete from public.vendors v where v.is_placeholder and not exists (select 1 from public.pickups k where k.vendor_id = v.id);
    delete from auth.users where email like 'demo-reviewer-%@iwc-demo.invalid';
    update public.regions set hero_image_path = null where hero_image_path like 'regions/%/demo-%';
    delete from public.region_photos where storage_path like 'regions/%/album/demo-%';`);

  // 2. Every state live, spices cleared (before the pantry goes in live), demo mode on.
  await client.query(`
    update public.regions set is_live = true where not is_live;
    update public.pricing_settings set spices_cleared = true where id = 1;
    insert into public.app_settings (key, value) values ('dev_preview', 'true'::jsonb)
    on conflict (key) do update set value = 'true'::jsonb;`);
  // 3. The master catalogue: one placeholder shop per state, then the listings and their options.
  await client.query(`
    insert into public.vendors (id, shop_name, region_id, status, is_placeholder)
    select md5('iwc-master-vendor:' || r.slug)::uuid, 'Catalogue placeholder shop (' || r.name || ')', r.id, 'active', true
    from public.regions r where r.slug = any ($1)`, [[...new Set(listings.map((l) => l.region))]]);
  const products = listings.map(({ variants, ...l }) => ({ ...l, first_g: variants[0].weight_g }));
  const inserted = await client.query(`
    insert into public.products (id, slug, name, product_type, region_id, category_id, vendor_id, summary, price_cents,
                                 price_auto, shop_price_paise, status, is_placeholder, is_curated, published_at)
    select md5('iwc-master:' || m.slug)::uuid, m.slug, m.name, m.product_type, r.id, c.id,
           md5('iwc-master-vendor:' || r.slug)::uuid, m.summary,
           coalesce(public._auto_price_cents(m.shop_paise, coalesce(m.first_g, c.default_weight_g)), 999),
           m.product_type <> 'spice', m.shop_paise, 'live', true, m.curated, now() - m.age * interval '1 minute'
    from jsonb_to_recordset($1::jsonb) as m (slug text, name text, product_type public.product_type, region text,
         category text, summary text, shop_paise integer, curated boolean, age integer, first_g integer)
    join public.regions r on r.slug = m.region
    join public.categories c on c.slug = m.category and c.product_type = m.product_type`, [JSON.stringify(products)]);
  if (inserted.rowCount !== listings.length) throw new Error(`Only ${inserted.rowCount} of ${listings.length} listings found their state and category.`);
  const variants = listings.flatMap((l) => l.variants.map((v, i) => ({ ...v, slug: l.slug, sort: i + 1 })));
  // Pantry packs carry their own price (D-075 per pack); clothing and home take the listing's price.
  await client.query(`
    insert into public.product_variants (product_id, sku, label, options, price_cents, weight_g, qty_listed, sort_order)
    select md5('iwc-master:' || v.slug)::uuid, v.sku, v.label, v.options,
           case when v.shop_paise is not null then public._auto_price_cents(v.shop_paise, v.weight_g) end,
           v.weight_g, v.qty, v.sort
    from jsonb_to_recordset($1::jsonb) as v (slug text, sku text, label text, options jsonb, shop_paise integer,
         weight_g integer, qty integer, sort integer)`, [JSON.stringify(variants)]);

  const { rows: summary } = await client.query(`
    select p.product_type::text as type, count(distinct p.id)::int as listings,
           count(distinct p.id) filter (where p.price_cents = 999)::int as unpriced, count(v.id)::int as options
    from public.products p left join public.product_variants v on v.product_id = p.id group by 1 order by 1`);

  for (const [what, n] of Object.entries(removed)) console.log(`${apply ? 'Removed' : 'Would remove'}: ${n} ${what}`);
  console.log(`${apply ? 'Removing' : 'Would remove'}: ${paths.length} stored photos.`);
  for (const s of summary)
    console.log(`${apply ? 'Added' : 'Would add'}: ${s.listings} ${s.type} listings with ${s.options} options${s.unpriced ? ` (${s.unpriced} without a price: fill Settings)` : ''}`);
  console.log(`Every state live, spices cleared, demo mode on.`);
  await client.query(apply ? 'commit' : 'rollback');
} catch (error) {
  await client.query('rollback').catch(() => {});
  throw error;
} finally {
  await client.end();
}
if (!apply) {
  console.log('Dry run: nothing changed. Run again with --apply.');
} else {
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from('product-media').remove(paths.slice(i, i + 100));
    if (error) console.log(`Some photos were not removed from storage: ${error.message}`);
  }
  console.log('Master catalogue loaded. The store pages refresh within 5 minutes (or redeploy).');
}

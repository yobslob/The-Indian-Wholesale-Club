#!/usr/bin/env node
/**
 * scripts/demo.mjs: the demo round (D-078). Loads, or clears again, a demo store on the database you point it at:
 * the placeholder catalogue of five states (catalogue/data, every row is_placeholder = true), the free-licence photos
 * in catalogue/photos (`pnpm demo:photos`, with their credits), labelled demo reviews from eight demo reviewer
 * accounts, and demo mode on (dev_preview: the store shows placeholders and the demo banner).
 *
 *   pnpm demo:load  --url=<postgres URL> --api=<https://<ref>.supabase.co> --service-key=<service role key> [--allow-remote] [--apply]
 *   pnpm demo:clear --url=<postgres URL> --api=…  --service-key=…  [--allow-remote] [--apply]
 *
 * Without --apply nothing changes: load says what it would do; clear counts what it would remove (inside a
 * transaction it rolls back). On the local database the API and key come from apps/web/.env.local.
 * Clear removes every placeholder product with its photos, sizes and reviews, every order that contains one (demo
 * orders, paid in Stripe test mode), the placeholder shops, the demo reviewer accounts and the demo state photos, and
 * turns demo mode off. Real products, real orders, settings and cycles are not touched.
 */
import { existsSync, readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { uploadCataloguePhotos } from './lib/catalogue-photos.mjs';

export const DEMO_REGIONS = ['delhi', 'maharashtra', 'kerala', 'assam', 'punjab'];
const REVIEWER_EMAIL = (n) => `demo-reviewer-${n}@iwc-demo.invalid`;
const REVIEWERS = ['Anjali R.', 'Rohit S.', 'Meera N.', 'Harpreet K.', 'Arjun M.', 'Priya D.', 'Bidisha B.', 'Vikram P.'];
/** Demo review text by rating (Claude-written, shown only with the "Demo review" label). */
const TEXTS = {
  5: [
    'Beautiful piece. The colour is exactly what I hoped for and it came well packed.',
    'Took me straight back home. The fabric feels lovely.',
    'Wore it to a family wedding and got so many compliments.',
    'Gorgeous work and worth the wait.',
    'Just like the ones my mother had. Lovely quality.',
  ],
  4: [
    'Lovely piece. Delivery took a little longer than I hoped, but it was worth it.',
    'Good quality. The colour is slightly darker than in the photo.',
    'Really nice. I would go a size up next time.',
    'Very happy with it, the stitching is neat.',
  ],
  3: [
    'Nice enough, but the fabric is thinner than I expected.',
    'The colour was a little different from the photo. Still wearable.',
    'It is okay. It took a while to arrive.',
  ],
  2: ['Not quite what I imagined; the fit was off for me.', 'Pretty, but a thread came loose after the first wear.'],
  1: ['It did not work out for me, so I sent it back.'],
};

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const apply = args.includes('--apply');
if (!['load', 'clear'].includes(command ?? '')) {
  console.error('Usage: node scripts/demo.mjs load|clear --url=… --api=… --service-key=… [--allow-remote] [--apply]');
  process.exit(2);
}
for (const file of ['apps/web/.env.local', 'apps/web/.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const dbUrl = flag('url') ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const local = (u) => ['127.0.0.1', 'localhost', '::1'].includes(new URL(u).hostname);
const api = flag('api') ?? (local(dbUrl) ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined);
const serviceKey = flag('service-key') ?? (local(dbUrl) ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
if (!api || !serviceKey) {
  console.error('Pass --api=<https://<ref>.supabase.co> and --service-key=<service role key> (Supabase → Project settings → API).');
  process.exit(2);
}
if ((!local(dbUrl) || !local(api)) && !args.includes('--allow-remote')) {
  console.error('Refusing a non-local database without --allow-remote.');
  process.exit(2);
}
if (local(dbUrl) !== local(api)) {
  console.error('--url and --api point at different projects (one local, one hosted).');
  process.exit(2);
}

const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
const db = createClient(api, serviceKey, { auth: { persistSession: false } });

try {
  if (command === 'load') await load();
  else await clear();
} finally {
  await client.end();
}

async function load() {
  if (!apply) {
    console.log(`Dry run. With --apply this loads:
  1. supabase/seed/catalogue.sql for ${DEMO_REGIONS.join(', ')} (Rajasthan's listings are left out), demo mode on;
  2. the photos in catalogue/photos for those states (pnpm demo:photos fetched them), with their credits;
  3. demo reviews from ${REVIEWERS.length} demo reviewer accounts on about 60% of the clothing listings.`);
    return;
  }
  // 1. The catalogue, in one transaction.
  await client.query('begin');
  try {
    await client.query(readFileSync('supabase/seed/catalogue.sql', 'utf8'));
    await client.query(`
      delete from public.products p using public.regions r
       where p.region_id = r.id and r.slug <> all ($1) and p.is_placeholder
         and not exists (select 1 from public.order_items i where i.product_id = p.id);
      `.trim(), [DEMO_REGIONS]);
    await client.query("update public.regions set is_live = false where slug = 'rajasthan'");
    await client.query(`insert into public.app_settings (key, value) values ('dev_preview', 'true'::jsonb)
                        on conflict (key) do update set value = 'true'::jsonb`);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
  const { rows: [counts] } = await client.query(`
    select count(*) filter (where product_type = 'clothing')::int as clothing,
           count(*) filter (where product_type = 'spice')::int as pantry
    from public.products where is_placeholder`);
  console.log(`Catalogue: ${counts.clothing} clothing listings (live), ${counts.pantry} pantry (drafts until spices are cleared).`);

  // 2. Photos.
  const photos = await uploadCataloguePhotos(db, { regions: DEMO_REGIONS, prefix: 'demo-' });
  console.log(`Photos on ${photos.productsWithPhotos} listings.`);

  // 3. Demo reviewers and their reviews (replacing any earlier demo reviews).
  const reviewerIds = [];
  for (const [i] of REVIEWERS.entries()) {
    const email = REVIEWER_EMAIL(i + 1);
    const { data: existing } = await db.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existing) {
      reviewerIds.push(existing.id);
      continue;
    }
    const { data, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(), // never used: nobody signs in as a demo reviewer
      user_metadata: { full_name: `Demo reviewer ${i + 1}` },
    });
    if (error) throw new Error(`demo reviewer ${email}: ${error.message}`);
    reviewerIds.push(data.user.id);
  }
  await client.query('delete from public.reviews where is_placeholder');
  const { rows: listings } = await client.query(`
    select p.id, p.slug from public.products p join public.regions r on r.id = p.region_id
    where p.is_placeholder and p.product_type = 'clothing' and p.status = 'live' and r.slug = any ($1)`, [DEMO_REGIONS]);
  const rows = [];
  for (const listing of listings) {
    const h = hash(listing.slug);
    if (h % 10 >= 6) continue; // about 60% of listings have reviews
    const count = 1 + (h % 4);
    for (let n = 0; n < count; n += 1) {
      const r = hash(`${listing.slug}:${n}`);
      const roll = r % 100;
      const rating = roll < 45 ? 5 : roll < 80 ? 4 : roll < 92 ? 3 : roll < 98 ? 2 : 1;
      const reviewer = (h + n) % REVIEWERS.length;
      rows.push({
        product_id: listing.id,
        user_id: reviewerIds[reviewer],
        rating,
        body: TEXTS[rating][r % TEXTS[rating].length],
        display_name: REVIEWERS[reviewer],
        is_placeholder: true,
        created_at: new Date(Date.now() - (1 + (r % 60)) * 86_400_000).toISOString(),
      });
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from('reviews').insert(rows.slice(i, i + 200));
    if (error) throw new Error(`demo reviews: ${error.message}`);
  }
  await client.query(`update public.reviews set status = 'approved', moderated_at = now() where is_placeholder`);
  console.log(`Demo reviews: ${rows.length} on ${new Set(rows.map((r) => r.product_id)).size} listings.`);
  console.log('Demo store loaded. The store pages refresh within 5 minutes (or redeploy). Clear it with pnpm demo:clear.');
}

async function clear() {
  await client.query('begin');
  let paths = [];
  try {
    await client.query(`
      create temporary table demo_products on commit drop as select id from public.products where is_placeholder;
      create temporary table demo_orders on commit drop as
        select distinct o.id, o.order_number from public.orders o join public.order_items i on i.order_id = o.id
        left join public.product_variants v on v.id = i.variant_id
        where i.product_id in (select id from demo_products) or v.product_id in (select id from demo_products);`);
    const count = async (sql) => (await client.query(sql)).rows[0].n;
    const summary = {
      'demo products': await count('select count(*)::int as n from demo_products'),
      'demo orders (with their lines, events, pickups and returns)': await count('select count(*)::int as n from demo_orders'),
      'placeholder shops': await count('select count(*)::int as n from public.vendors where is_placeholder'),
      'demo reviews': await count('select count(*)::int as n from public.reviews where is_placeholder'),
      'demo reviewer accounts': await count(`select count(*)::int as n from auth.users where email like 'demo-reviewer-%@iwc-demo.invalid'`),
    };
    paths = [
      ...(await client.query('select storage_path from public.product_media where product_id in (select id from demo_products)')).rows,
      ...(await client.query(`select hero_image_path as storage_path from public.regions where hero_image_path like 'regions/%/demo-%'`)).rows,
      ...(await client.query(`select storage_path from public.region_photos where storage_path like 'regions/%/album/demo-%'`)).rows,
    ].map((r) => r.storage_path);

    await client.query(`
      delete from public.email_outbox where payload ->> 'orderNumber' in (select order_number from demo_orders);
      delete from public.orders where id in (select id from demo_orders);
      delete from public.vendor_payouts where vendor_id in (select id from public.vendors where is_placeholder);
      delete from public.products where id in (select id from demo_products);
      delete from public.vendors v where v.is_placeholder and not exists (select 1 from public.products p where p.vendor_id = v.id);
      delete from public.reviews where is_placeholder;
      delete from auth.users where email like 'demo-reviewer-%@iwc-demo.invalid';
      update public.regions set hero_image_path = null where hero_image_path like 'regions/%/demo-%';
      delete from public.region_photos where storage_path like 'regions/%/album/demo-%';
      update public.app_settings set value = 'false'::jsonb where key = 'dev_preview';`);
    for (const [what, n] of Object.entries(summary)) console.log(`${apply ? 'Removed' : 'Would remove'}: ${n} ${what}`);
    console.log(`${apply ? 'Removing' : 'Would remove'}: ${paths.length} stored photos; demo mode ${apply ? 'is now' : 'would be'} off.`);
    await client.query(apply ? 'commit' : 'rollback');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
  if (!apply) {
    console.log('Dry run: nothing changed. Run again with --apply.');
    return;
  }
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await db.storage.from('product-media').remove(paths.slice(i, i + 100));
    if (error) console.log(`Some photos were not removed from storage: ${error.message}`);
  }
  console.log('Demo cleared. Switch Vercel (and the app) back to the live Stripe keys before real customers buy.');
}

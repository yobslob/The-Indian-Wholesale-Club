#!/usr/bin/env node
/**
 * scripts/build-catalogue.mjs: turns catalogue/data/<region>.mjs (the launch regions' catalogue, D-059) into
 * supabase/seed/catalogue.sql, a DEV seed that runs after demo.sql.
 *
 *   node scripts/build-catalogue.mjs            write the seed
 *   node scripts/build-catalogue.mjs --check    fail if the seed is out of date (check.mjs `docs` step)
 *   node scripts/build-catalogue.mjs --apply    write it, then load it into the LOCAL database without a reset
 *   node scripts/build-catalogue.mjs --folders  create catalogue/photos/<region>/<product>/ for every listing
 *
 * Everything the catalogue does not say (prices, pieces, shops) is a DEV PLACEHOLDER: every row is
 * is_placeholder = true (D-012), prices and pieces are derived from the slug so the output is stable. Pantry items
 * are drafts: spices cannot go live (D-032, a database rule). Product ids are derived from the slug, so loading it
 * again updates the same listings and keeps their photos and pieces.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REGIONS = ['delhi', 'punjab', 'rajasthan', 'assam', 'maharashtra', 'kerala'];
const OUT = 'supabase/seed/catalogue.sql';
const PHOTOS = 'catalogue/photos';
const CODES = { delhi: 'DEL', punjab: 'PUN', rajasthan: 'RAJ', assam: 'ASM', maharashtra: 'MAH', kerala: 'KER' };

// DEV PLACEHOLDER price bands in cents (the lowest pack for the pantry). Not business decisions (D-012).
const BANDS = {
  sarees: [6900, 18900], kurtas: [3900, 8900], 'suits-and-sets': [6900, 15900], lehengas: [12900, 29900],
  'dupattas-and-stoles': [2900, 7900], shawls: [4900, 14900], 'dhotis-and-mundus': [2900, 6900],
  'jeans-and-trousers': [4900, 8900], 'shirts-and-tops': [2900, 6900], 'co-ords-and-dresses': [5900, 11900],
  'jackets-and-knitwear': [5900, 14900], headwear: [1900, 4900], footwear: [3900, 8900], accessories: [1500, 4900],
  kids: [2900, 6900], fabrics: [2500, 6900],
  'whole-spices': [499, 999], 'ground-spices': [499, 999], 'masala-blends': [499, 899],
  'pickles-and-chutneys': [699, 1199], 'papad-and-wadi': [599, 999], 'snacks-and-namkeen': [599, 1099],
  sweets: [899, 1799], 'rice-flours-and-staples': [799, 1599], 'tea-and-drinks': [799, 1499],
};
const TIER = { premium: 2.5, bridal: 3.5 };
const PACK_STEP = [1, 1.8, 3.2]; // price of the 2nd and 3rd pack size against the first

const hash = (s) => createHash('sha256').update(s).digest().readUInt32BE(0);
const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const cents = (v, floor = 999) => Math.max(floor, Math.floor(v / 100) * 100 - 1); // $x.99, never below the floor
const q = (s) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const arr = (xs) => `array[${xs.map(q).join(', ')}]::text[]`;

const { COLOURS, SIZES, PACKS } = await import(pathToFileURL('catalogue/data/sets.mjs').href);

// Category slugs and their product type, read from the category seed (one source of truth).
const categories = new Map(
  [...readFileSync('supabase/seed/categories.sql', 'utf8').matchAll(/\('(clothing|spice)', '([a-z0-9-]+)'/g)].map(
    (m) => [m[2], m[1]],
  ),
);

const problems = [];
const listings = [];
for (const region of REGIONS) {
  const items = (await import(pathToFileURL(`catalogue/data/${region}.mjs`).href)).default;
  const launch = items.filter((i) => i.launch !== undefined).sort((a, b) => a.launch - b.launch);
  items.forEach((item, index) => {
    const slug = `${region}-${item.slug ?? slugify(item.name)}`;
    const where = `${region}: ${item.name}`;
    if (categories.get(item.category) !== item.type) problems.push(`${where}: category "${item.category}" is not a ${item.type} category`);
    const band = BANDS[item.category] ?? [1999, 4999];
    const base = band[0] + (hash(slug) % (band[1] - band[0]));
    const price = cents(base * (TIER[item.tier] ?? 1), item.type === 'spice' ? 399 : 999);
    const rank = launch.indexOf(item);
    const row = {
      slug, region, name: item.name, type: item.type, category: item.category, summary: item.summary,
      price, shopPaise: Math.round(price * 24.9), origin: item.from ?? null,
      status: item.type === 'spice' ? 'draft' : 'live',
      // Launch picks are the newest (New arrivals), then the rest in file order.
      age: rank >= 0 ? rank + 1 : 100 + index,
      curated: rank >= 0 && rank < 4 && item.type === 'clothing',
      skuPrefix: `${CODES[region]}-${String(index + 1).padStart(3, '0')}`,
    };
    if (item.type === 'clothing') {
      row.colours = Array.isArray(item.colours) ? item.colours : COLOURS[item.colours];
      row.sizes = Array.isArray(item.sizes) ? item.sizes : SIZES[item.sizes];
      if (!row.colours?.length) problems.push(`${where}: unknown colours "${item.colours}"`);
      if (!row.sizes?.length) problems.push(`${where}: unknown sizes "${item.sizes}"`);
    } else {
      const packs = PACKS[item.packs];
      if (!packs) problems.push(`${where}: unknown packs "${item.packs}"`);
      row.packs = (packs ?? []).map(([label, grams], i) => ({ label, weight_g: grams, price_cents: cents(price * PACK_STEP[i] + 100, 399) }));
    }
    listings.push(row);
  });
}
const seen = new Set();
for (const l of listings) {
  if (seen.has(l.slug)) problems.push(`duplicate slug ${l.slug}`);
  seen.add(l.slug);
}
if (problems.length) {
  console.error(`Catalogue problems:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const clothing = listings.filter((l) => l.type === 'clothing');
const pantry = listings.filter((l) => l.type === 'spice');
const vendorId = (region) => `00000000-0000-4000-8000-0000000003${String(REGIONS.indexOf(region) + 1).padStart(2, '0')}`;
const productValues = listings.map(
  (l) =>
    `  (${[q(l.slug), q(l.name), q(l.type), q(l.region), q(l.category), q(l.summary), l.price, l.shopPaise, q(l.origin),
      q(l.status), l.age, l.curated].join(', ')})`,
);
const clothingValues = clothing.map((l) => `  (${q(l.slug)}, ${q(l.skuPrefix)}, ${arr(l.colours)}, ${arr(l.sizes)})`);
const pantryValues = pantry.map((l) => `  (${q(l.slug)}, ${q(l.skuPrefix)}, ${q(JSON.stringify(l.packs))}::jsonb)`);

const sql = `-- =============================================================================
-- DEV, and the demo round in production only through pnpm demo:load (D-078). GENERATED by scripts/build-catalogue.mjs from catalogue/data:
-- edit those files, not this one (\`node scripts/build-catalogue.mjs\`).
-- The launch regions' catalogue (D-059): ${listings.length} listings, ${clothing.length} clothing (live) and
-- ${pantry.length} pantry (drafts, D-032). Items are the catalogue's; colours are listing options; prices, pieces
-- and shops are DEV PLACEHOLDERS (is_placeholder = true, D-012) until real shops are signed up.
-- Product ids come from the slug, so loading this again updates the same listings (photos and pieces stay).
-- =============================================================================

update public.regions set is_live = true where slug in (${REGIONS.map(q).join(', ')});

insert into public.vendors (id, shop_name, region_id, status, is_placeholder)
select v.id::uuid, 'Catalogue placeholder shop (' || r.name || ')', r.id, 'active', true
from (values
${REGIONS.map((r) => `  (${q(vendorId(r))}, ${q(r)})`).join(',\n')}
) as v (id, region_slug)
join public.regions r on r.slug = v.region_slug
on conflict (id) do nothing;

create temporary table catalogue_products (
  slug text, name text, product_type public.product_type, region_slug text, category_slug text, summary text,
  price_cents integer, shop_price_paise integer, origin_town text, status public.product_status, age integer,
  is_curated boolean
);
insert into catalogue_products values
${productValues.join(',\n')};

insert into public.products (id, slug, name, product_type, region_id, category_id, vendor_id, summary, price_cents,
                             shop_price_paise, origin_town, status, is_placeholder, is_curated, published_at)
select md5('iwc-catalogue:' || p.slug)::uuid, p.slug, p.name, p.product_type, r.id, c.id, v.id, p.summary,
       p.price_cents, p.shop_price_paise, p.origin_town, p.status, true, p.is_curated,
       case when p.status = 'live' then now() - p.age * interval '1 minute' end
from catalogue_products p
join public.regions r on r.slug = p.region_slug
join public.categories c on c.slug = p.category_slug and c.product_type = p.product_type
join public.vendors v on v.region_id = r.id and v.shop_name like 'Catalogue placeholder shop (%'
on conflict (id) do update set
  name = excluded.name, category_id = excluded.category_id, summary = excluded.summary,
  price_cents = excluded.price_cents, shop_price_paise = excluded.shop_price_paise,
  origin_town = excluded.origin_town, is_curated = excluded.is_curated,
  status = case when public.products.status = 'archived' then excluded.status else public.products.status end;

-- Listings removed from catalogue/data are archived, not deleted (orders may point at them).
update public.products set status = 'archived'
where vendor_id in (select id from public.vendors where shop_name like 'Catalogue placeholder shop (%')
  and slug not in (select slug from catalogue_products);

-- Clothing: one variant per colour × size. Pieces are a DEV PLACEHOLDER from the SKU (0 to 10, some sold out).
create temporary table catalogue_clothing (slug text, sku_prefix text, colours text[], sizes text[]);
insert into catalogue_clothing values
${clothingValues.join(',\n')};

insert into public.product_variants (product_id, sku, label, options, qty_listed, sort_order)
select md5('iwc-catalogue:' || c.slug)::uuid,
       c.sku_prefix || '-' || lpad(ci::text, 2, '0') || lpad(si::text, 2, '0'),
       case when c.sizes = array['Free size'] then colour else colour || ' · ' || size end,
       jsonb_build_object('colour', colour, 'size', size),
       abs(hashtext(c.sku_prefix || ci || '-' || si)) % 11,
       (ci * 100 + si)::integer
from catalogue_clothing c
cross join lateral unnest(c.colours) with ordinality as col (colour, ci)
cross join lateral unnest(c.sizes) with ordinality as sz (size, si)
on conflict (sku) do update set label = excluded.label, options = excluded.options, sort_order = excluded.sort_order;

-- Pantry: one variant per pack size, priced per pack.
create temporary table catalogue_pantry (slug text, sku_prefix text, packs jsonb);
insert into catalogue_pantry values
${pantryValues.join(',\n')};

insert into public.product_variants (product_id, sku, label, options, price_cents, weight_g, qty_listed, sort_order)
select md5('iwc-catalogue:' || c.slug)::uuid,
       c.sku_prefix || '-' || lpad(pi::text, 2, '0'),
       pack ->> 'label',
       jsonb_build_object('size', pack ->> 'label'),
       (pack ->> 'price_cents')::integer,
       (pack ->> 'weight_g')::integer,
       abs(hashtext(c.sku_prefix || pi)) % 11,
       pi::integer
from catalogue_pantry c
cross join lateral jsonb_array_elements(c.packs) with ordinality as pk (pack, pi)
on conflict (sku) do update set label = excluded.label, options = excluded.options,
  price_cents = excluded.price_cents, weight_g = excluded.weight_g, sort_order = excluded.sort_order;

drop table catalogue_products, catalogue_clothing, catalogue_pantry;
`;

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== sql) {
    console.error(`${OUT} is out of date: run node scripts/build-catalogue.mjs`);
    process.exit(1);
  }
  console.log(`Catalogue seed OK (${listings.length} listings).`);
  process.exit(0);
}
writeFileSync(OUT, sql);
console.log(`Wrote ${OUT}: ${clothing.length} clothing, ${pantry.length} pantry, ` +
  `${clothing.reduce((n, l) => n + l.colours.length * l.sizes.length, 0) + pantry.reduce((n, l) => n + l.packs.length, 0)} variants.`);

if (args.includes('--folders')) {
  let made = 0;
  for (const l of listings) {
    for (const dir of [`${PHOTOS}/${l.region}/_region`, `${PHOTOS}/${l.region}/${l.slug.slice(l.region.length + 1)}`]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        made += 1;
      }
    }
  }
  console.log(`Photo folders ready under ${PHOTOS} (${made} new).`);
}

if (args.includes('--apply')) {
  const { default: pg } = await import('pg');
  const url = process.env.SUPABASE_TEST_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  if (!['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname)) {
    console.error('Refusing: --apply only loads into local Supabase.');
    process.exit(2);
  }
  const db = new pg.Client(url);
  await db.connect();
  try {
    await db.query('begin');
    await db.query(sql);
    await db.query('commit');
  } catch (e) {
    await db.query('rollback');
    throw e;
  } finally {
    await db.end();
  }
  console.log('Loaded into the local database. The store cache refreshes within 5 minutes, or restart the web server.');
}

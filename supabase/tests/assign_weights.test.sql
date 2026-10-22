-- Assign all, accept, publish in steps, rename all, archive the drafts that cannot go live (migration
-- 20261022090000_assign_weights, D-146). Weights are admin-only (INV-1); placeholders are never touched.
begin;
select tests.setup();
alter table public.products disable trigger products_wears;
update public.pricing_settings set food_cleared = true where id = 1;

insert into public.categories (product_type, slug, name, default_weight_g) values ('home', 'test-home', 'Test home', 1500);
select tests.remember('cat_home', (select id from public.categories where slug = 'test-home'));
insert into public.categories (product_type, slug, name, default_weight_g) values ('home', 'test-home-empty', 'Empty home', 600);
select tests.remember('cat_empty', (select id from public.categories where slug = 'test-home-empty'));

-- Four brass diyas already weighed (their shop's pages), one brass bell, and the piece to weigh
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, shop_price_paise, status)
select 'aw-ref-' || n, name, 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 2000, paise, 'live'
  from (values (1, 'Brass Diya Pair', 20000), (2, 'Small Brass Diya', 21000), (3, 'Brass Kuber Diya', 19000),
               (4, 'Brass Akhand Diya', 22000), (5, 'Heavy Brass Temple Bell', 90000)) as r(n, name, paise);
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g, weight_source)
select p.id, 'AW-REF-' || p.slug, 'One size', 3, w, 'shop'
  from public.products p
  join (values ('aw-ref-1', 300), ('aw-ref-2', 320), ('aw-ref-3', 340), ('aw-ref-4', 360), ('aw-ref-5', 2400)) as r(slug, w)
    on r.slug = p.slug;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, shop_price_paise, status)
values ('aw-diya', 'Brass Diya for Pooja', 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 2000, 20500, 'draft'),
       ('aw-lonely', 'Wooden Toran', 'home', tests.id('region'), tests.id('cat_empty'), tests.id('vendor'), 2000, 30000, 'draft'),
       ('aw-kurta', 'Cotton Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 80000, 'draft'),
       ('aw-nophoto', 'Brass Lamp', 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 2000, 20000, 'draft');
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, 'AW-' || slug, 'One size', 3 from public.products where slug in ('aw-diya', 'aw-lonely', 'aw-kurta', 'aw-nophoto');
insert into public.product_media (product_id, storage_path, is_primary)
select id, 'products/' || id || '/s/1.jpg', true from public.products where slug in ('aw-diya', 'aw-lonely', 'aw-kurta');
update public.product_variants set weight_g = 500, weight_source = 'admin' where sku = 'TEST-LIVE-1';

-- Admins only
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_weight_plan()', 'admin_only', 'a customer cannot read the plan');
select tests.assert_fails('select public.admin_assign_weights(''[]'')', 'admin_only', 'nor assign weights');
select tests.assert_fails('select public.admin_accept_weights()', 'admin_only', 'nor accept them');
select tests.assert_fails('select public.admin_rename_listings(''[]'')', 'admin_only', 'nor rename listings');
select tests.assert_fails('select public.admin_archive_unready_drafts()', 'admin_only', 'nor archive drafts');
select tests.act_as(tests.id('fake_admin'));
select tests.assert_fails('select public.admin_weight_plan()', 'admin_only', 'an admin role without the allowlist cannot either');

select tests.act_as(tests.id('admin'));
create temp table plan on commit drop as select public.admin_weight_plan(200) as j;
select tests.assert(
  (select count(*) = 4 from plan, jsonb_array_elements(j -> 'rows') r where r ->> 'name' in ('Brass Diya for Pooja', 'Wooden Toran', 'Cotton Kurta', 'Brass Lamp')),
  'the plan names the drafts with an option that has no weight');
select tests.assert(
  not exists (select 1 from plan, jsonb_array_elements(j -> 'rows') r where (r ->> 'product_id')::uuid = tests.id('p_placeholder')),
  'never a placeholder');

-- The rules' weight for the kurta (class), the database's for the rest; a 'class' weight for a home piece is ignored.
select public.admin_assign_weights(jsonb_build_array(
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'AW-aw-kurta'), 'weight_g', 350,
                     'source', 'class', 'note', 'Light, 350 g: a kurta (D-132)'),
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'AW-aw-diya'), 'weight_g', 5,
                     'source', 'class', 'note', 'wrong'),
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'AW-aw-lonely')),
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'AW-aw-nophoto')),
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'TEST-PH-1')),
  jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'TEST-LIVE-1'), 'weight_g', 9000,
                     'source', 'class')));
select tests.assert((select weight_g = 350 and weight_source = 'class' from public.product_variants where sku = 'AW-aw-kurta'),
  'a clothing class weight is written as the rules gave it');
select tests.assert(
  (select weight_g = 340 and weight_source = 'estimated' and weight_note like '%of 5 similar test home pieces (₹190 – ₹900)%'
     from public.product_variants where sku = 'AW-aw-diya'),
  'a home piece gets the middle weight of the most similar pieces weighed before (the bell does not move the middle)');
select tests.assert(
  (select weight_g = 600 and weight_source = 'estimated' and weight_note like 'The usual weight of empty home%'
     from public.product_variants where sku = 'AW-aw-lonely'),
  'with too few similar pieces, the category''s usual weight');
select tests.assert((select weight_g = 500 from public.product_variants where sku = 'TEST-LIVE-1'),
  'an option that has a weight is never overwritten');
select tests.assert((select weight_g is null from public.product_variants where sku = 'TEST-PH-1'),
  'a placeholder is never weighed');
select tests.assert((select (j ->> 'left')::int = 0 from (select public.admin_weight_plan(0) as j) x)
                    or not exists (select 1 from jsonb_array_elements(public.admin_weight_plan(200) -> 'rows') r
                                    where r ->> 'name' like 'Brass%' or r ->> 'name' in ('Wooden Toran', 'Cotton Kurta')),
  'the plan has nothing left of them');

-- Accept: a weight Weights to check shows leaves the list; a new weight brings it back.
update public.product_variants set weight_g = 330, weight_source = 'similar', weight_note = 'Another option'
 where sku = 'AW-aw-diya';
select tests.assert(exists (select 1 from jsonb_array_elements(public.admin_weights_to_check(0, 200) -> 'rows') r
                             where r ->> 'name' = 'Brass Diya for Pooja'), 'a matching item''s weight is listed to check');
select tests.assert((select (j ->> 'accepted')::int >= 1 from (select public.admin_accept_weights() as j) x), 'accept all');
select tests.assert(not exists (select 1 from jsonb_array_elements(public.admin_weights_to_check(0, 200) -> 'rows') r
                                 where r ->> 'name' = 'Brass Diya for Pooja'), 'an accepted weight leaves the list');
update public.product_variants set weight_g = 345, weight_note = 'Another option again' where sku = 'AW-aw-diya';
select tests.assert((select weight_checked_at is null from public.product_variants where sku = 'AW-aw-diya'),
  'a new weight clears the acceptance');

-- Publish in steps: one at a time says how many ready drafts are left.
create temp table pub on commit drop as select public.admin_publish_drafts(1) as j;
select tests.assert((select (j ->> 'published')::int = 1 and (j ->> 'left')::int >= 2 and (j ->> 'no_photo')::int >= 1 from pub),
  'one published, the other ready drafts left, the one without a photo held');
create temp table pub2 on commit drop as select public.admin_publish_drafts() as j;
select tests.assert(
  (select count(*) = 3 from public.products where slug in ('aw-diya', 'aw-lonely', 'aw-kurta') and status = 'live'),
  'the rest go live on the next call');

-- Archive the drafts that cannot go live
create temp table arc on commit drop as select public.admin_archive_unready_drafts() as j;
select tests.assert((select (j ->> 'no_photo')::int >= 1 from arc), 'counted by reason');
select tests.assert((select status = 'archived' from public.products where slug = 'aw-nophoto'), 'the draft without a photo is archived');
select tests.assert((select status = 'draft' from public.products where id = tests.id('p_draft'))
                    = exists (select 1 from public.product_media where product_id = tests.id('p_draft')),
  'a draft that has its photo stays a draft');

-- Rename all keeps each old name as the shop title, refuses an empty name
select tests.assert(
  public.admin_rename_listings(jsonb_build_array(
    jsonb_build_object('id', (select id from public.products where slug = 'aw-kurta'), 'name', 'Handloom Cotton Kurta'),
    jsonb_build_object('id', (select id from public.products where slug = 'aw-diya'), 'name', ' '))) = 1,
  'one renamed, the empty name refused');
select tests.assert((select name = 'Handloom Cotton Kurta' and shop_title = 'Cotton Kurta' from public.products where slug = 'aw-kurta'),
  'the old name is kept as the shop title');

-- Customers never see weights or the acceptance
reset role;
set local role anon;
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_product_page('test-region', 'aw-diya')) k
               where k = any (tests.forbidden_keys() || array['weight_checked_at'])),
  'the product page carries no weight fields');
rollback;

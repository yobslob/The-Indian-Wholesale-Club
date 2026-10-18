-- Weights (migration 20261015160000, D-129): every weight says where it came from, the runner never overwrites a
-- person's, sizes share a weight but packs never do, nothing goes live on a guessed weight, a new item on a live
-- listing waits for its weight, and the admin's list and the runner's backfill find the rest. None of it reaches
-- customers (INV-1).
begin;
select tests.setup();
-- Generic test clothing: D-140's "who it is for" rule has its own test (wears_and_rows.test.sql).
alter table public.products disable trigger products_wears;
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.categories set default_weight_g = 450 where id = tests.id('cat_clothing');
update public.pricing_settings set food_cleared = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('weight-kurta', 'Weight kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft');
select tests.remember('kurta', (select id from public.products where slug = 'weight-kurta'));

-- The admin's options: a typed weight is the admin's; a size without one takes its sibling's (marked similar).
set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
values (tests.id('kurta'), 'WK-M', 'M', '{"size": "M"}', 5, 420);
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('kurta'), 'WK-L', 'L', '{"size": "L"}', 5);
select tests.assert((select weight_source = 'admin' and weight_g = 420 from public.product_variants where sku = 'WK-M'),
  'a weight typed by an admin is marked as theirs');
select tests.assert((select weight_g = 420 and weight_source = 'similar' and weight_note like '%option of this piece: M'
                       from public.product_variants where sku = 'WK-L'),
  'another size of the same piece takes its sibling''s weight, marked as from a matching item');

-- A pack never borrows: a 1 kg pack is not a 200 g one.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('weight-bhujia', 'Weight bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 300, 'draft');
select tests.remember('bhujia', (select id from public.products where slug = 'weight-bhujia'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
values (tests.id('bhujia'), 'WB-200', '200 g', '{"pack": "200 g"}', 5, 200);
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('bhujia'), 'WB-1K', '1 kg', '{"pack": "1 kg"}', 5);
select tests.assert((select weight_g is null and weight_source is null from public.product_variants where sku = 'WB-1K'),
  'a pack without its own weight stays without one');

-- Nothing goes live on a guess.
select tests.assert_fails(format('update public.products set status = %L where id = %L', 'live', tests.id('bhujia')),
  'weight_missing', 'a listing with an option that has no weight cannot go live');
update public.products set status = 'live', published_at = now() where id = tests.id('kurta');
select tests.assert((select status = 'live' from public.products where id = tests.id('kurta')),
  'a listing whose every option has a weight goes live');
select tests.assert_fails(format('update public.product_variants set weight_g = null where sku = %L', 'WK-M'),
  'weight_missing', 'a live option cannot lose its weight');
select tests.assert_fails(
  format('insert into public.product_variants (product_id, sku, label, options, qty_listed) values (%L, %L, %L, %L, 1)',
         tests.id('kurta'), 'WK-PACK', 'Pack of 2', '{"pack": "2"}'),
  'weight_missing', 'an admin adding an option without a weight to a live listing is told so');

-- Publish all drafts holds the draft and says why.
insert into public.product_media (product_id, storage_path, is_primary) values (tests.id('bhujia'), 'products/b/1.jpg', true);
create temp table pd on commit drop as select public.admin_publish_drafts() as j;
select tests.assert((select (j ->> 'no_weight')::int >= 1 from pd), 'Publish all drafts counts the draft without a weight');
select tests.assert((select status = 'draft' from public.products where id = tests.id('bhujia')), 'and leaves it a draft');

-- The admin's list: the pack without a weight, and the size from its sibling; a weighed option is trusted.
select tests.assert(
  (select (j ->> 'missing')::int >= 1 and exists (select 1 from jsonb_array_elements(j -> 'rows') r where (r ->> 'id')::uuid = tests.id('bhujia'))
          and exists (select 1 from jsonb_array_elements(j -> 'rows') r where (r ->> 'id')::uuid = tests.id('kurta'))
     from (select public.admin_weights_to_check() as j) x),
  'Weights to check lists the missing pack and the size that borrowed its weight');
update public.product_variants set weight_g = 430, weight_source = 'weighed', weight_note = 'Hub scale'
 where product_id = tests.id('kurta');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.admin_weights_to_check() -> 'rows') r
               where (r ->> 'id')::uuid = tests.id('kurta')),
  'weighed options leave the list');
update public.product_variants set weight_g = 90, weight_source = 'shop' where sku = 'WK-L';
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.admin_weights_to_check() -> 'rows') r
           where (r ->> 'id')::uuid = tests.id('kurta')),
  'a shop''s 90 g for a kurta (usually 450 g) is listed to check');
update public.product_variants set weight_g = 430, weight_source = 'weighed' where sku = 'WK-L';

-- Nobody else reads or writes it.
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_weights_to_check()', 'admin_only', 'a customer cannot read the list');
select tests.assert_fails('select public.worker_weight_plan()', 'worker_only', 'nor the runner''s plan');
select tests.assert_fails('select public.worker_set_weights(''[]'')', 'worker_only', 'nor write weights');
reset role;
select tests.assert(
  not exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'store_variants' and column_name like 'weight%'),
  'INV-1: no weight, source or note in the store''s variants');

-- The runner: never over a person's weight; fills a missing one; a shop's reading replaces a similar one.
select tests.remember('v1k', (select id from public.product_variants where sku = 'WB-1K'));
select tests.remember('vm', (select id from public.product_variants where sku = 'WK-M'));
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(
  (select bool_or((p ->> 'product_id')::uuid = tests.id('bhujia')) and not bool_or((p ->> 'product_id')::uuid = tests.id('kurta'))
     from jsonb_array_elements(public.worker_weight_plan()) p),
  'the runner''s plan has the listing missing a weight, not the weighed one');
select tests.assert(public.worker_set_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('v1k'), 'weight_g', 1000, 'source', 'similar',
                       'note', 'amazon.in: Net Quantity: 1 kg'),
    jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 300, 'source', 'shop', 'note', 'myntra'))) = 1,
  'worker_set_weights fills the missing weight and counts only it');
reset role;
-- the trigger too (RLS aside): a worker session changing a weighed weight keeps the weighed one
select tests.act_as(tests.id('worker'));
update public.product_variants set weight_g = 999 where id = tests.id('vm');
select set_config('request.jwt.claims', '', true);
select tests.assert((select weight_g = 430 and weight_source = 'weighed' from public.product_variants where sku = 'WK-M'),
  'the runner never overwrites a weighed weight');
select tests.assert((select weight_g = 1000 and weight_source = 'similar' from public.product_variants where sku = 'WB-1K'),
  'the pack has the matching item''s weight');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_set_weights(jsonb_build_array(jsonb_build_object(
  'variant_id', tests.id('v1k'), 'weight_g', 1010, 'source', 'shop', 'note', 'Net Quantity: 1.01 kg')));
reset role;
select tests.assert((select weight_g = 1010 and weight_source = 'shop' from public.product_variants where sku = 'WB-1K'),
  'the shop''s own page replaces a matching item''s weight');

-- A new item the weekly check finds on a live listing waits, inactive, until it has a weight.
reset role;
update public.products set status = 'live', published_at = now() where id = tests.id('bhujia');
-- as worker_sourcing_checked adds it (a security definer function, so row security aside)
select tests.act_as(tests.id('worker'));
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('bhujia'), 'WB-5K', '5 kg', '{"pack": "5 kg"}', 0);
select set_config('request.jwt.claims', '', true);
select tests.assert((select not is_active and weight_note = 'Waiting for its weight (D-129)' from public.product_variants where sku = 'WB-5K'),
  'a new item without a weight on a live listing is held');
select tests.remember('v5k', (select id from public.product_variants where sku = 'WB-5K'));
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_set_weights(jsonb_build_array(jsonb_build_object(
  'variant_id', tests.id('v5k'), 'weight_g', 5000, 'source', 'shop', 'note', 'Pack: 5 kg')));
reset role;
select tests.assert((select is_active and weight_source = 'shop' and weight_note = 'Pack: 5 kg' from public.product_variants where sku = 'WB-5K'),
  'once it has its weight it sells again');

-- Seeds and maintenance (no admin or worker) are not held; demo rows never are.
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('p_placeholder'), 'DEMO-W', 'Demo', '{"pack": "1 kg"}', 1);
select tests.assert((select is_active from public.product_variants where sku = 'DEMO-W'), 'a demo option is never held');

rollback;

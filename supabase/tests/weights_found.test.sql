-- D-202 (migration 20261120090000): food weights from where they are written. The runner's page re-read moves
-- through the whole backlog (tried listings go to the back); matching items that agree may replace an estimate;
-- customers see only a weight someone read or weighed; the label reader and the price check read what they need,
-- and a corrected weight reprices at once.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
insert into public.categories (product_type, slug, name) values ('home', 'wf-home', 'WF home');

insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, price_auto,
                             shop_price_paise, created_at)
values ('wf-sattu', 'Deepak Jau Sattu', 'food', tests.id('region'), tests.id('cat_food'), 512, 'draft', true, 8715,
        now() - interval '3 days'),
       ('wf-chips', 'Found chips', 'food', tests.id('region'), tests.id('cat_food'), 300, 'draft', true, 5000,
        now() - interval '2 days'),
       ('wf-label', 'Labelled bhujia 400 g', 'food', tests.id('region'), tests.id('cat_food'), 900, 'draft', true, 10000,
        now() - interval '1 day'),
       ('wf-lamp', 'Found brass lamp', 'home', tests.id('region'), (select id from public.categories where slug = 'wf-home'), 900, 'draft', true, 10000, now());
select tests.remember('sattu', (select id from public.products where slug = 'wf-sattu'));
select tests.remember('chips', (select id from public.products where slug = 'wf-chips'));
select tests.remember('label', (select id from public.products where slug = 'wf-label'));
select tests.remember('lamp', (select id from public.products where slug = 'wf-lamp'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source, weight_note,
                                     shop_price_paise, net_qty)
values (tests.id('sattu'), 'WF-S', 'One size', '{}', 5, 140, 'estimated', 'Estimated 140 g', 8715, null),
       (tests.id('chips'), 'WF-C', 'One size', '{}', 5, 150, 'estimated', 'Estimated 150 g', 5000, null),
       (tests.id('label'), 'WF-L', '400 g', '{"pack": "400 g"}', 5, 400, 'packed', '400 g net (its pack) (D-135)', 10000, '400 g'),
       (tests.id('lamp'), 'WF-H', 'One size', '{}', 5, 300, 'estimated', 'Estimated 300 g', 10000, null);
select tests.remember('vs', (select id from public.product_variants where sku = 'WF-S'));
select tests.remember('vc', (select id from public.product_variants where sku = 'WF-C'));
insert into public.product_media (product_id, storage_path, sort_order, is_primary)
values (tests.id('sattu'), 'products/sattu/s/front.jpg', 0, true),
       (tests.id('sattu'), 'products/sattu/s/back.jpg', 1, false),
       (tests.id('label'), 'products/label/s/front.jpg', 0, true);

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_label_plan()', 'worker_only', 'an admin cannot read the label plan');
select tests.assert_fails('select public.worker_food_prices()', 'worker_only', 'nor the food prices');
select tests.assert_fails('select public.worker_weights_tried(''{}'', ''page'')', 'worker_only', 'nor mark listings tried');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.worker_weight_plan(40, null)', 'worker_only', 'a customer cannot read the plan');

-- 1. The queue: of the types asked, never tried first; a tried listing goes to the back.
select tests.act_as(tests.id('worker'));
create temp table q1 on commit drop as
  select (p ->> 'product_id')::uuid as id, n
    from jsonb_array_elements(public.worker_weight_plan(40, '{food}')) with ordinality as e(p, n);
select tests.assert(not exists (select 1 from q1 where id = tests.id('lamp')), 'only the types asked for');
select tests.assert(not exists (select 1 from q1 where id = tests.id('label')), 'not a listing whose label was read');
select tests.assert((select id from q1 where n = 1) = tests.id('sattu'), 'the oldest untried first');
select tests.assert_fails('select public.worker_weights_tried(''{}'', ''everything'')', 'tried_invalid', 'page or label only');
select tests.assert(public.worker_weights_tried(array[tests.id('sattu')], 'page') = 1, 'the sattu''s pages were read');
select tests.assert(
  ((public.worker_weight_plan(40, '{food}') -> 0) ->> 'product_id')::uuid = tests.id('chips'),
  'the next run starts with the one not tried yet');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.worker_weight_plan(40, '{food}')) p
           where (p ->> 'product_id')::uuid = tests.id('sattu')),
  'a tried listing is still in the queue, at the back');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.worker_weight_plan(40)) p
           where (p ->> 'product_id')::uuid = tests.id('lamp')),
  'no types: every type, as before');

-- 2. Matching items that agree replace an estimate; never a read weight.
select tests.assert(public.worker_set_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 500, 'source', 'similar',
                       'note', 'Net quantity: 500 g (2 matching items on amazon.in, flipkart.com agree)'),
    jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'WF-L'), 'weight_g', 999,
                       'source', 'similar', 'note', 'wrong'))) = 1,
  'the estimate is replaced, the label''s weight is not');
reset role;
select tests.assert((select weight_g = 500 and weight_source = 'similar' from public.product_variants where sku = 'WF-S'),
  'the sattu weighs what the matching items agree on');
select tests.assert((select price_cents = 1490 from public.product_variants where sku = 'WF-S'),
  'and is repriced at once: (₹87.15 ÷ 0.90 + 500 g × ₹2) ÷ 0.80 ÷ ₹92 = $14.90 (was $5.12 on 140 g)');

-- 3. Customers see only a weight someone read.
select tests.assert(public._store_pack(tests.id('chips'), 'Found chips', 'food') is null, 'an estimate is not shown');
select tests.assert(public._store_pack(tests.id('label'), 'Labelled bhujia 400 g', 'food') = '400 g', 'a label''s is');
update public.product_variants set weight_source = 'shop', weight_note = 'amazon.in: Net Quantity: 150 g' where sku = 'WF-C';
select tests.assert(public._store_pack(tests.id('chips'), 'Found chips', 'food') = '150 g', 'and a shop page''s');
update public.product_variants set weight_source = 'estimated' where sku = 'WF-C';

-- 4. The label reader's plan: food with photos whose weight nobody read; the eval's known ones; tried ones leave.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert_fails('select public.worker_label_plan(null, 10, ''everything'')', 'mode_invalid', 'a mode is one of three');
create temp table lp on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_label_plan(null, 50, 'new')) p;
select tests.assert((select count(*) = 1 from lp) and exists (select 1 from lp where id = tests.id('sattu')),
  'the sattu only: the chips have no photo, the bhujia''s label was read, the lamp is not food');
select tests.assert((select (p -> 'photos' -> 0 ->> 'path') = 'products/sattu/s/front.jpg'
                            and jsonb_array_length(p -> 'photos') = 2 from lp),
  'with its photos, the main one first');
select tests.assert(
  (select (p ->> 'product_id')::uuid from jsonb_array_elements(public.worker_label_plan(null, 50, 'known')) p) = tests.id('label'),
  'the eval reads the listing whose label is known from its own words');
select public.worker_weights_tried(array[tests.id('sattu')], 'label');
select tests.assert(jsonb_array_length(public.worker_label_plan(null, 50, 'new')) = 0, 'a read listing leaves the new plan');
select tests.assert(jsonb_array_length(public.worker_label_plan(null, 50, 'all')) = 1, 'but not the all plan');

-- The label's weight goes in as the label's (D-135), and customers see it.
select public.worker_set_food_weights(jsonb_build_array(jsonb_build_object(
  'variant_id', tests.id('vs'), 'weight_g', 500, 'note', 'Label photo: Net 500 g, both readers agree (D-202)',
  'net_qty', '500 g')));
reset role;
select tests.assert((select weight_source = 'packed' and net_qty = '500 g' from public.product_variants where sku = 'WF-S'),
  'the label''s weight is the packed one');
select tests.assert(public._store_pack(tests.id('sattu'), 'Deepak Jau Sattu', 'food') = '500 g', 'and shown');

-- 5. The price check's read: every food option with its shop price, never home.
set local role authenticated;
select tests.act_as(tests.id('worker'));
create temp table fp on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_food_prices(null, 500)) p;
select tests.assert(not exists (select 1 from fp where id = tests.id('lamp'))
                    and (select (p -> 'variants' -> 0 ->> 'shop_price_paise')::integer = 5000 from fp where id = tests.id('chips')),
  'food options with their shop prices');
-- its write is worker_set_estimates: a sure estimate replaces an estimate, never a label's weight
select public.worker_set_estimates(jsonb_build_array(
  jsonb_build_object('variant_id', tests.id('vc'), 'weight_g', 200, 'sure', true, 'note', 'Price check (D-202): …'),
  jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 140, 'sure', true, 'note', 'Price check (D-202): …')));
reset role;
select tests.assert((select weight_g = 200 and weight_source = 'estimated' from public.product_variants where sku = 'WF-C'),
  'the price check corrects an estimate');
select tests.assert((select weight_g = 500 and weight_source = 'packed' from public.product_variants where sku = 'WF-S'),
  'and never a label''s weight');

rollback;

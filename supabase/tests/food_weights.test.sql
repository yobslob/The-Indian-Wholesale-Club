-- Food's packed weight (migration 20261016160000, D-133): the worker reads the food listings to work out and writes
-- each option's packed weight (source 'packed') and net quantity; never over the hub's scale or an admin's weight,
-- never on clothing; the runner's page search and the estimator leave it alone; an admin's typed weight does not
-- replace one weighed at the hub; customers see the net quantity only; the runner's new food keeps its packed weight.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.pricing_settings set food_cleared = true, beta_pricing = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             price_auto, shop_price_paise, description)
values ('fw-pickle', 'Mango pickle in glass jar 500 g', 'food', tests.id('region'), tests.id('cat_food'),
        tests.id('vendor'), 900, 'draft', true, 20000, 'Sun-dried. Net Weight: 500 g'),
       ('fw-kurta', 'Food test kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
        3000, 'draft', true, 100000, null);
select tests.remember('pickle', (select id from public.products where slug = 'fw-pickle'));
select tests.remember('kurta', (select id from public.products where slug = 'fw-kurta'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source, weight_note,
                                     shop_price_paise)
values (tests.id('pickle'), 'FW-1', 'Sweet', '{"flavour": "Sweet"}', 5, 500, 'shop', 'Pack: 500 g', 20000),
       (tests.id('pickle'), 'FW-2', 'Spicy', '{"flavour": "Spicy"}', 5, 610, 'weighed', 'Weighed at the hub, order 1', null),
       (tests.id('pickle'), 'FW-3', 'Hot', '{"flavour": "Hot"}', 5, 640, 'admin', null, null),
       (tests.id('pickle'), 'FW-4', 'Mild', '{"flavour": "Mild"}', 5, 300, 'estimated', 'Estimated 300 g', null),
       (tests.id('kurta'), 'FW-K', 'M', '{"size": "M"}', 5, null, null, null, null);
select tests.remember('sweet', (select id from public.product_variants where sku = 'FW-1'));
select tests.remember('spicy', (select id from public.product_variants where sku = 'FW-2'));
select tests.remember('hot', (select id from public.product_variants where sku = 'FW-3'));
select tests.remember('mild', (select id from public.product_variants where sku = 'FW-4'));
select tests.remember('vk', (select id from public.product_variants where sku = 'FW-K'));
create temp table before_price on commit drop as
  select price_cents from public.product_variants where id = tests.id('sweet');

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_food_plan()', 'worker_only', 'an admin cannot read the food plan');
select tests.assert_fails('select public.worker_set_food_weights(''[]'')', 'worker_only', 'nor write food weights');

-- What to work out: the food listing with its description, not the clothing one.
select tests.act_as(tests.id('worker'));
create temp table plan_rows on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_food_plan(null, 200)) p;
select tests.assert(exists (select 1 from plan_rows where id = tests.id('pickle'))
                    and not exists (select 1 from plan_rows where id = tests.id('kurta')),
  'the plan has food only');
select tests.assert((select p ->> 'description' like '%Net Weight: 500 g%' and p ->> 'category' is not null
                       from plan_rows where id = tests.id('pickle')),
  'with its description and category for the rules');

-- Writing: a shop's and an estimated weight become packed; a weighed and a typed one keep their weight but get the
-- net quantity; clothing and a bad weight are skipped.
select tests.assert(public.worker_set_food_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('sweet'), 'weight_g', 795, 'net_qty', '500 g',
                       'note', '500 g net (its name) + glass jar, wrapped 295 g (D-133)'),
    jsonb_build_object('variant_id', tests.id('spicy'), 'weight_g', 795, 'net_qty', '500 g', 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('hot'), 'weight_g', null, 'net_qty', '500 g', 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('mild'), 'weight_g', 795, 'net_qty', '500 g', 'note', 'y (D-133)'),
    jsonb_build_object('variant_id', tests.id('vk'), 'weight_g', 795, 'net_qty', '500 g', 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('sweet'), 'weight_g', 99999, 'note', 'x'))) = 4,
  'four food options changed; the kurta and the bad weight did not');
reset role;
select tests.assert((select weight_g = 795 and weight_source = 'packed' and net_qty = '500 g' and weight_note like '500 g net%'
                       from public.product_variants where id = tests.id('sweet')),
  'the packed weight, marked packed, with its reason and net quantity');
select tests.assert((select weight_g = 610 and weight_source = 'weighed' and net_qty = '500 g'
                       from public.product_variants where id = tests.id('spicy'))
                    and (select weight_g = 640 and weight_source = 'admin' and net_qty = '500 g'
                           from public.product_variants where id = tests.id('hot')),
  'the hub''s scale and an admin''s weight stay; they still get their net quantity');
select tests.assert((select weight_g = 795 and weight_source = 'packed' from public.product_variants where id = tests.id('mild')),
  'an estimate is replaced');
select tests.assert((select weight_g is null and net_qty is null from public.product_variants where id = tests.id('vk')),
  'clothing is not touched');
select tests.assert((select v.price_cents > b.price_cents from public.product_variants v, before_price b where v.id = tests.id('sweet')),
  'the option is repriced on its packed weight (D-128)');

-- Once worked out: not asked again (unless all), a re-run changes nothing, and nothing automatic overwrites it.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_food_plan(null, 200)) p
                                 where (p ->> 'product_id')::uuid = tests.id('pickle')),
  'a listing whose options are all packed or a person''s, with their net quantity, is done');
select tests.assert(exists (select 1 from jsonb_array_elements(public.worker_food_plan(null, 200, true)) p
                             where (p ->> 'product_id')::uuid = tests.id('pickle')),
  'all again reads it');
select tests.assert(public.worker_set_food_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('sweet'), 'weight_g', 795, 'net_qty', '500 g',
                       'note', '500 g net (its name) + glass jar, wrapped 295 g (D-133)'))) = 0,
  'the same weight again changes nothing');
select tests.assert(public.worker_set_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('sweet'), 'weight_g', 500, 'source', 'shop', 'note', 'amazon'))) = 0,
  'a shop''s page does not replace a packed weight');
select public.worker_set_estimates(jsonb_build_array(
  jsonb_build_object('variant_id', tests.id('sweet'), 'weight_g', 300, 'sure', true, 'note', 'Estimated 300 g')));
reset role;
select tests.assert((select weight_g = 795 and weight_source = 'packed' from public.product_variants where id = tests.id('sweet')),
  'nor does an estimate');

-- D-133's order: an admin's typed weight does not replace the hub's scale; a new weighing does.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('update public.product_variants set weight_g = 500, weight_source = %L where id = %L',
                                 'admin', tests.id('spicy')),
  'weight_weighed', 'a typed weight over a weighed one is refused');
update public.product_variants set weight_g = 620, weight_source = 'weighed', weight_note = 'weighed again'
 where id = tests.id('spicy');
update public.product_variants set weight_g = 700, weight_source = 'admin' where id = tests.id('sweet');
reset role;
select tests.assert((select weight_g = 620 from public.product_variants where id = tests.id('spicy')),
  'weighing it again replaces it');
select tests.assert((select weight_g = 700 and weight_source = 'admin' from public.product_variants where id = tests.id('sweet')),
  'an admin''s weight replaces the system''s');

-- Customers see the net quantity (on the card and the option), never the packed weight or where it came from.
update public.products set status = 'live', published_at = now() where id = tests.id('pickle');
set local role anon;
select tests.assert((select net_qty = '500 g' from public.store_variants where id = tests.id('sweet')),
  'the store''s option has its net quantity');
reset role;
select tests.assert(public._store_pack(tests.id('pickle'), 'Mango pickle', 'food') = '500 g',
  'the card''s pack size falls back to the net quantity');
select tests.assert(not exists (select 1 from tests.json_keys(public.store_product_page('test-region', 'fw-pickle')) k
                                 where k = any (tests.forbidden_keys())),
  'the product page has no weight, source or note');

-- The runner's new food listing keeps its packed weight and net quantity; clothing cannot be "packed".
set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.sourcing_targets (name, query, product_type, category_id, region_id)
values ('Food weight chikki', 'chikki', 'food', tests.id('cat_food'), tests.id('region'))
returning tests.remember('target', id);
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_plan();
select tests.remember('added', (public.worker_sourcing_add(tests.id('target'), jsonb_build_object(
  'site', 'amazon.in', 'shop_label', 'Amazon India', 'page_url', 'https://www.amazon.in/dp/B0FW000001',
  'name', 'Peanut chikki 200 g', 'slug', 'fw-peanut-chikki', 'attributes', '{}'::jsonb,
  'variants', jsonb_build_array(
    jsonb_build_object('item_key', 'B0FW000001', 'item_url', 'https://www.amazon.in/dp/B0FW000001', 'label', '200 g',
                       'options', jsonb_build_object('pack', '200 g'), 'price_paise', 10000, 'in_stock', true,
                       'delivery_days', 2, 'weight_g', 270, 'weight_source', 'packed', 'net_qty', '200 g',
                       'weight_note', '200 g net (its pack) + sweet box 64 g: sweets (D-133)')))) ->> 'product_id')::uuid);
reset role;
select tests.assert((select weight_g = 270 and weight_source = 'packed' and net_qty = '200 g'
                       from public.product_variants where product_id = tests.id('added')),
  'the runner''s packed weight and net quantity are kept');

rollback;

-- Clothing by class (migration 20261016090000, D-132): the worker reads the clothing listings to sort and writes each
-- option's class weight (source 'class'), never over a weight weighed at the hub or typed by an admin, never on food;
-- shop pages and the estimator then leave it alone, and the estimator no longer reads clothing.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
update public.pricing_settings set food_cleared = true, beta_pricing = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             price_auto, shop_price_paise)
values ('cls-kurta-set', 'Class kurta with pyjama', 'clothing', tests.id('region'), tests.id('cat_clothing'),
        tests.id('vendor'), 3000, 'draft', true, 100000),
       ('cls-food', 'Class bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft',
        false, null);
select tests.remember('set', (select id from public.products where slug = 'cls-kurta-set'));
select tests.remember('food', (select id from public.products where slug = 'cls-food'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source)
values (tests.id('set'), 'CK-S', 'S', '{"size": "S"}', 5, null, null),
       (tests.id('set'), 'CK-M', 'M', '{"size": "M"}', 5, 420, 'shop'),
       (tests.id('set'), 'CK-L', 'L', '{"size": "L"}', 5, 610, 'weighed'),
       (tests.id('set'), 'CK-XL', 'XL', '{"size": "XL"}', 5, 640, 'admin'),
       (tests.id('food'), 'CF-1', '1 kg', '{"pack": "1 kg"}', 5, null, null);
select tests.remember('vs', (select id from public.product_variants where sku = 'CK-S'));
select tests.remember('vm', (select id from public.product_variants where sku = 'CK-M'));
select tests.remember('vl', (select id from public.product_variants where sku = 'CK-L'));
select tests.remember('vxl', (select id from public.product_variants where sku = 'CK-XL'));
select tests.remember('vf', (select id from public.product_variants where sku = 'CF-1'));
create temp table before_price on commit drop as select price_cents from public.products where slug = 'cls-kurta-set';

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_clothing_plan()', 'worker_only', 'an admin cannot read the clothing plan');
select tests.assert_fails('select public.worker_set_class_weights(''[]'')', 'worker_only', 'nor write class weights');

-- What to sort: the clothing listing, not the food one.
select tests.act_as(tests.id('worker'));
create temp table plan_ids on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_clothing_plan(null, 200)) p;
select tests.assert(exists (select 1 from plan_ids where id = tests.id('set'))
                    and not exists (select 1 from plan_ids where id = tests.id('food')),
  'the plan has clothing only');
select tests.assert((select p ->> 'category_slug' is not null from plan_ids where id = tests.id('set')),
  'with its category for the rules');

-- Writing: a missing and a shop weight take the class; a weighed and a typed one stay; food is never touched.
select tests.assert(public.worker_set_class_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 1500, 'note', 'Heavy, 1.5 kg: a set (with pyjama) (D-132)'),
    jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 1500, 'note', 'Heavy, 1.5 kg: a set (with pyjama) (D-132)'),
    jsonb_build_object('variant_id', tests.id('vl'), 'weight_g', 1500, 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('vxl'), 'weight_g', 1500, 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('vf'), 'weight_g', 1500, 'note', 'x'),
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 'heavy'))) = 2,
  'two options took their class; the rest were not the worker''s to change');
reset role;
select tests.assert((select bool_and(weight_g = 1500 and weight_source = 'class' and weight_note like 'Heavy, 1.5 kg%')
                       from public.product_variants where id in (tests.id('vs'), tests.id('vm'))),
  'the class weight, marked class, with its reason');
select tests.assert((select weight_g = 610 and weight_source = 'weighed' from public.product_variants where id = tests.id('vl'))
                    and (select weight_g = 640 and weight_source = 'admin' from public.product_variants where id = tests.id('vxl')),
  'a weight weighed at the hub or typed by an admin is never replaced');
select tests.assert((select weight_g is null from public.product_variants where id = tests.id('vf')),
  'food is not weighed by class');
select tests.assert((select p.price_cents <> b.price_cents from public.products p, before_price b where p.id = tests.id('set')),
  'the listing is repriced on its class weight (D-128)');

-- Once sorted: not asked again (unless sorting all again), a re-run changes nothing, and nothing else overwrites it.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_clothing_plan(null, 200)) p
                                 where (p ->> 'product_id')::uuid = tests.id('set')),
  'a listing whose options all have a class or a person''s weight is done');
select tests.assert(exists (select 1 from jsonb_array_elements(public.worker_clothing_plan(null, 200, true)) p
                             where (p ->> 'product_id')::uuid = tests.id('set')),
  'sorting all again reads it');
select tests.assert(public.worker_set_class_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 1500, 'note', 'Heavy, 1.5 kg: a set (with pyjama) (D-132)'))) = 0,
  'the same class again changes nothing');
select tests.assert(public.worker_set_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 380, 'source', 'shop', 'note', 'myntra'))) = 0,
  'a shop''s page does not replace a class weight');
select public.worker_set_estimates(jsonb_build_array(
  jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 380, 'sure', true, 'note', 'Estimated 380 g')));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_estimate_plan(null, 200, 'audit')) p
                                 where (p ->> 'product_id')::uuid = tests.id('set')),
  'the estimator no longer reads clothing');
reset role;
select tests.assert((select weight_g = 1500 and weight_source = 'class' from public.product_variants where id = tests.id('vs')),
  'nor does an estimate replace it');

-- A class weight is the founder's rule: Weights to check does not list it as unusual.
update public.categories set default_weight_g = 300 where id = tests.id('cat_clothing');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.admin_weights_to_check() -> 'rows') r
                                 where (r ->> 'id')::uuid = tests.id('set')),
  'a 1.5 kg set in a 300 g category is not "unusual"');
reset role;

rollback;

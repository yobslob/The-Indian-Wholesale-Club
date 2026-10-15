-- The weight estimator (migration 20261015180000, D-131): the worker reads what to estimate and the weights IWC knows,
-- keeps every estimate, and a sure one becomes the weight of an option that has none (or only an estimate). It never
-- changes a person's weight or a shop's; a shop's page replaces an estimate; Weights to check shows what it doubts.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');
-- a home piece in two sizes: clothing is weighed by class since D-132, not by the estimator
insert into public.categories (product_type, slug, name, default_weight_g) values ('home', 'est-home', 'Est home', 450);
select tests.remember('cat_home', (select id from public.categories where slug = 'est-home'));
update public.pricing_settings set food_cleared = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('est-kurta', 'Estimate brass lamp', 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 3000, 'draft'),
       ('est-pickle', 'Estimate pickle', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft'),
       ('est-saffron', 'Estimate saffron', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft');
select tests.remember('kurta', (select id from public.products where slug = 'est-kurta'));
select tests.remember('pickle', (select id from public.products where slug = 'est-pickle'));
select tests.remember('saffron', (select id from public.products where slug = 'est-saffron'));
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g, weight_source)
values (tests.id('kurta'), 'EK-M', 'M', '{"size": "M"}', 5, null, null),
       (tests.id('kurta'), 'EK-L', 'L', '{"size": "L"}', 5, null, null),
       (tests.id('pickle'), 'EP-500', '500 g', '{"pack": "500 g"}', 5, null, null),
       (tests.id('saffron'), 'ES-1', 'One size', '{}', 5, 1, 'shop');
select tests.remember('vm', (select id from public.product_variants where sku = 'EK-M'));
select tests.remember('vl', (select id from public.product_variants where sku = 'EK-L'));
select tests.remember('vp', (select id from public.product_variants where sku = 'EP-500'));
select tests.remember('vs', (select id from public.product_variants where sku = 'ES-1'));

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails('select public.worker_estimate_plan()', 'worker_only', 'an admin cannot read the estimator''s plan');
select tests.assert_fails('select public.worker_set_estimates(''[]'')', 'worker_only', 'nor write estimates');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.worker_weight_references()', 'worker_only', 'a customer cannot read known weights');

-- What to estimate.
select tests.act_as(tests.id('worker'));
select tests.assert_fails('select public.worker_estimate_plan(null, 10, ''everything'')', 'mode_invalid', 'a mode is one of three');
create temp table plan_ids on commit drop as
  select (p ->> 'product_id')::uuid as id, p from jsonb_array_elements(public.worker_estimate_plan(null, 200)) p;
select tests.assert((select count(*) = 2 from plan_ids where id in (tests.id('kurta'), tests.id('pickle')))
                    and not exists (select 1 from plan_ids where id = tests.id('saffron')),
  'by default: the listings with options that have no weight, not one with a shop''s weight');
select tests.assert((select bool_and((v ->> 'wanted')::boolean) and count(*) = 2
                       from plan_ids, jsonb_array_elements(p -> 'variants') v where id = tests.id('kurta')),
  'every option to estimate is marked wanted');
select tests.assert(exists (select 1 from jsonb_array_elements(public.worker_estimate_plan(null, 200, 'audit')) p
                             where (p ->> 'product_id')::uuid = tests.id('saffron')),
  'an audit also looks at a shop''s weight');

-- Writing: sure ones become weights, an unsure one stays an estimate, a shop's weight only gets one.
select tests.assert(public.worker_set_estimates(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 420, 'sure', true, 'note', 'Estimated 420 g packed'),
    jsonb_build_object('variant_id', tests.id('vl'), 'weight_g', 420, 'sure', true, 'note', 'Estimated 420 g packed'),
    jsonb_build_object('variant_id', tests.id('vp'), 'weight_g', 560, 'sure', false, 'note', 'Estimated 560 g. Check: wide'),
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 25, 'sure', true, 'note', 'Estimated 25 g packed'),
    jsonb_build_object('variant_id', tests.id('vs'), 'weight_g', 'heavy', 'sure', true)))
  = '{"estimates": 4, "weights": 2}'::jsonb,
  'four estimates kept, two became weights; nonsense is skipped');
reset role;
select tests.assert((select weight_g = 420 and weight_source = 'estimated' and weight_note = 'Estimated 420 g packed'
                            and weight_estimate_g = 420 and weight_estimated_at is not null
                       from public.product_variants where id = tests.id('vm')),
  'a sure estimate is the option''s weight, marked estimated');
select tests.assert((select weight_g is null and weight_estimate_g = 560 from public.product_variants where id = tests.id('vp')),
  'an unsure one is only a suggestion');
select tests.assert((select weight_g = 1 and weight_source = 'shop' and weight_estimate_g = 25
                       from public.product_variants where id = tests.id('vs')),
  'a shop''s weight is never changed, only compared');
update public.products set status = 'live', published_at = now() where id = tests.id('kurta');
select tests.assert((select status = 'live' from public.products where id = tests.id('kurta')),
  'a listing priced on sure estimates can go live');

-- Done once: not asked again by default; redo asks again, and a re-estimate stays an estimate.
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(not exists (select 1 from jsonb_array_elements(public.worker_estimate_plan(null, 200)) p
                                 where (p ->> 'product_id')::uuid in (tests.id('kurta'), tests.id('pickle'))),
  'an estimated option is not estimated again by default');
select tests.assert((select count(*) = 2 from jsonb_array_elements(public.worker_estimate_plan(null, 200, 'redo')) p
                      where (p ->> 'product_id')::uuid in (tests.id('kurta'), tests.id('pickle'))),
  'redo estimates them again');
select public.worker_set_estimates(jsonb_build_array(
  jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 430, 'sure', true, 'note', 'Estimated 430 g packed')));
reset role;
select tests.assert((select weight_g = 430 and weight_source = 'estimated' from public.product_variants where id = tests.id('vm')),
  'a new estimate replaces the old one and stays an estimate');

-- Weights to check: the pack still without a weight and the shop's weight the estimator doubts; not the kurta.
set local role authenticated;
select tests.act_as(tests.id('admin'));
create temp table due on commit drop as
  select (r ->> 'id')::uuid as id, r from jsonb_array_elements(public.admin_weights_to_check() -> 'rows') r;
select tests.assert(exists (select 1 from due where id = tests.id('pickle'))
                    and exists (select 1 from due where id = tests.id('saffron'))
                    and not exists (select 1 from due where id = tests.id('kurta')),
  'Weights to check lists the missing weight and the doubted shop weight, not the sure estimates');
select tests.assert((select (v ->> 'weight_estimate_g')::int = 560
                       from due, jsonb_array_elements(r -> 'variants') v where id = tests.id('pickle')),
  'with the estimator''s suggestion');

-- A person's weight is never touched, nor its estimate overwritten.
update public.product_variants set weight_g = 610 where id = tests.id('vp');
select tests.act_as(tests.id('worker'));
select tests.assert(public.worker_set_estimates(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vp'), 'weight_g', 500, 'sure', true, 'note', 'x'))) ->> 'estimates' = '0',
  'an option an admin weighed or typed is left alone');

-- The runner: a shop's own page replaces an estimate; a matching item's does not.
select tests.assert(public.worker_set_weights(jsonb_build_array(
    jsonb_build_object('variant_id', tests.id('vm'), 'weight_g', 400, 'source', 'shop', 'note', 'myntra'),
    jsonb_build_object('variant_id', tests.id('vl'), 'weight_g', 900, 'source', 'similar', 'note', 'amazon'))) = 1,
  'a shop''s page replaces an estimate, a matching item''s does not');

-- The known weights: the shop's and the admin's, never an estimate.
create temp table refs on commit drop as
  select (r ->> 'variant_id')::uuid as id, r from jsonb_array_elements(public.worker_weight_references(null, 1000)) r;
reset role;
select tests.assert(exists (select 1 from refs where id = tests.id('vm'))
                    and exists (select 1 from refs where id = tests.id('vp') and r ->> 'weight_source' = 'admin')
                    and not exists (select 1 from refs where id = tests.id('vl')),
  'the references are weighed, typed and shop weights, not estimates');

-- A new item held on a live listing (D-129) sells again once a sure estimate gives it a weight.
select tests.act_as(tests.id('worker'));
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('kurta'), 'EK-PACK', 'Pack of 2', '{"pack": "2"}', 0);
select set_config('request.jwt.claims', '', true);
select tests.remember('vpack', (select id from public.product_variants where sku = 'EK-PACK'));
select tests.assert((select not is_active from public.product_variants where id = tests.id('vpack')), 'the new item is held');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_set_estimates(jsonb_build_array(
  jsonb_build_object('variant_id', tests.id('vpack'), 'weight_g', 820, 'sure', true, 'note', 'Estimated 820 g packed')));
reset role;
select tests.assert((select is_active and weight_g = 820 and weight_source = 'estimated'
                       from public.product_variants where id = tests.id('vpack')),
  'it sells again on its estimate');

rollback;

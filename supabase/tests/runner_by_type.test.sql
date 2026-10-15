-- Two runners at once (migration 20261016120000): worker_sourcing_plan(checks, type, shop) hands each runner only its
-- own targets, shops and checks, so a clothing runner on nishorama.com and a food runner never take the same work.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

set local role authenticated;
select tests.act_as(tests.id('admin'));
insert into public.sourcing_targets (name, query, product_type, category_id, region_id, tier)
values ('Runner chikki', 'chikki', 'food', tests.id('cat_food'), tests.id('region'), 1)
returning tests.remember('food_target', id);
insert into public.sourcing_targets (name, query, product_type, category_id, region_id, tier)
values ('Runner kurta', 'kurta', 'clothing', tests.id('cat_clothing'), tests.id('region'), 1)
returning tests.remember('clothing_target', id);
insert into public.sourcing_targets (name, query, product_type, category_id, region_id, tier, sites)
values ('Runner Myntra saree', 'saree', 'clothing', tests.id('cat_clothing'), tests.id('region'), 1, '{myntra.com}')
returning tests.remember('myntra_target', id);

select tests.act_as(tests.id('worker'));
create temp table clothing_plan on commit drop as
  select public.worker_sourcing_plan(0, 'clothing', 'nishorama.com') as p;
select tests.assert((select jsonb_agg(t ->> 'id') = jsonb_build_array(tests.id('clothing_target'))
                       from clothing_plan, jsonb_array_elements(p -> 'targets') t),
  'the clothing runner on nishorama.com takes the clothing target open to every shop, not the food one nor Myntra''s');
select tests.assert((select jsonb_agg(s ->> 'site') = '["nishorama.com"]'::jsonb
                       from clothing_plan, jsonb_array_elements(p -> 'shops') s),
  'and searches only nishorama.com');
create temp table food_plan on commit drop as select public.worker_sourcing_plan(0, 'food') as p;
select tests.assert((select jsonb_agg(t ->> 'id') = jsonb_build_array(tests.id('food_target'))
                       from food_plan, jsonb_array_elements(p -> 'targets') t),
  'the food runner takes the food target');
select tests.assert((select bool_and('food' = any(array(select jsonb_array_elements_text(s -> 'product_types'))))
                       from food_plan, jsonb_array_elements(p -> 'shops') s),
  'with only shops that sell food');
select tests.assert(jsonb_array_length(public.worker_sourcing_plan(0) -> 'targets') = 1,
  'a runner without a type still takes what is left (Myntra''s saree)');

-- A target whose search failed everywhere goes back to the queue, ready for the next run.
reset role;
select tests.assert((select status = 'searching' from public.sourcing_targets where id = tests.id('clothing_target')),
  'the claimed target is being searched');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select public.worker_sourcing_target_release(tests.id('clothing_target'), 'nishorama.com: 429');
reset role;
select tests.assert((select status = 'queued' and claimed_at is null and note = 'nishorama.com: 429'
                       from public.sourcing_targets where id = tests.id('clothing_target')),
  'a released target is queued again, with why');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('select public.worker_sourcing_target_release(%L)', tests.id('food_target')),
  'worker_only', 'only the runner releases a target');
select tests.act_as(tests.id('worker'));

-- Checks: each runner re-reads only its type, and with a shop only listings sourced there alone.
reset role;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('runner-nisho', 'Runner nishorama kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('runner-myntra', 'Runner myntra kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('runner-food', 'Runner bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft');
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
select id, upper(slug), 'One size', '{}', 1, 300 from public.products where slug like 'runner-%';
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key)
select p.id, v.id, s.site, 'https://' || s.site || '/p/' || p.slug, 'https://' || s.site || '/p/' || p.slug, p.slug
  from public.products p join public.product_variants v on v.product_id = p.id
  join (values ('runner-nisho', 'nishorama.com'), ('runner-myntra', 'myntra.com'), ('runner-food', 'blinkit.com')) s(slug, site)
    on s.slug = p.slug;
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert((select jsonb_agg(c ->> 'name') = '["Runner nishorama kurta"]'::jsonb
                       from jsonb_array_elements(public.worker_sourcing_plan(400, 'clothing', 'nishorama.com') -> 'checks') c
                      where c ->> 'name' like 'Runner%'),
  'the nishorama.com runner re-checks only listings sourced there');
select tests.assert((select jsonb_agg(c ->> 'name') = '["Runner bhujia"]'::jsonb
                       from jsonb_array_elements(public.worker_sourcing_plan(400, 'food') -> 'checks') c
                      where c ->> 'name' like 'Runner%'),
  'the food runner re-checks only food');
reset role;

rollback;

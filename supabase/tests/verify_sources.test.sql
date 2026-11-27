-- `pnpm sourcing verify` (migration 20261130090000, founder 2026-11-27): the worker pages through the listings that
-- came from a shop (live and paused, drafts on request), keeps the shop's title where none was kept or only the name
-- was, and renames a food listing only while its name is still the one it read. Nobody else can.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, shop_title)
values ('vs-sev', 'Samrat', 'food', tests.id('region'), tests.id('cat_food'), 900, 'live', 'Samrat'),
       ('vs-oats', 'Pro.Fitness 27g High Protein Oats', 'food', tests.id('region'), tests.id('cat_food'), 900, 'live', null),
       ('vs-draft', 'VS draft', 'food', tests.id('region'), tests.id('cat_food'), 900, 'draft', null),
       ('vs-gone', 'VS gone', 'food', tests.id('region'), tests.id('cat_food'), 900, 'archived', null),
       ('vs-hand', 'VS by hand', 'food', tests.id('region'), tests.id('cat_food'), 900, 'live', null);
select tests.remember('sev', (select id from public.products where slug = 'vs-sev'));
select tests.remember('oats', (select id from public.products where slug = 'vs-oats'));
select tests.remember('draft', (select id from public.products where slug = 'vs-draft'));
select tests.remember('gone', (select id from public.products where slug = 'vs-gone'));
select tests.remember('hand', (select id from public.products where slug = 'vs-hand'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g, weight_source)
select id, upper(slug) || '-1', 'One size', 10, 27, 'packed' from public.products where slug like 'vs-%';
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise, in_stock)
select p.id, v.id, 'zepto.com', 'https://www.zepto.com/pn/x/pvid/' || p.slug, 'https://www.zepto.com/pn/x/pvid/' || p.slug,
       p.slug, 39900, true
  from public.products p join public.product_variants v on v.product_id = p.id
 where p.slug in ('vs-sev', 'vs-oats', 'vs-draft', 'vs-gone');
-- the clothing listing of the setup has a source too: the plan by type leaves it out
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise, in_stock)
values (tests.id('p_live'), tests.id('v_live'), 'myntra.com', 'https://www.myntra.com/1', 'https://www.myntra.com/1', '1',
        99900, true);

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails($$select public.worker_verify_plan()$$, 'worker_only', 'an admin cannot plan');
select tests.assert_fails($$select public.worker_set_shop_titles('[]')$$, 'worker_only', 'an admin cannot set titles');
select tests.assert_fails($$select public.worker_set_food_names('[]')$$, 'worker_only', 'an admin cannot rename');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails($$select public.worker_set_food_names('[]')$$, 'worker_only', 'a customer cannot rename');
set local role anon;
select tests.assert_fails($$select public.worker_verify_plan()$$, '42501', 'a visitor cannot plan');

set local role authenticated;
select tests.act_as(tests.id('worker'));
create temp table vplan on commit drop as select public.worker_verify_plan('food') as doc;
select tests.assert((select jsonb_array_length(doc) from vplan) = 2,
                    'food, live, from a shop: not the draft, the archived one, the one added by hand or clothing');
select tests.assert(jsonb_array_length(public.worker_verify_plan('food', null, 50, true)) = 3, 'drafts on request');
select tests.assert(jsonb_array_length(public.worker_verify_plan()) = 3, 'every type');
select tests.assert(jsonb_array_length(public.worker_verify_plan('food', null, 1)) = 1, 'a page');
select tests.assert(jsonb_array_length(public.worker_verify_plan('food',
                      (select (max(l ->> 'product_id'))::uuid from vplan, jsonb_array_elements(doc) l))) = 0,
                    'paging: nothing at or before the last id read');
create temp table vsev on commit drop as
  select l from vplan, jsonb_array_elements(doc) l where l ->> 'product_id' = tests.id('sev')::text;
select tests.assert((select l -> 'sources' -> 0 ->> 'item_key' = 'vs-sev' and l -> 'sources' -> 0 ->> 'label' = 'One size'
                            and l -> 'variants' -> 0 ->> 'weight_g' = '27'
                            and l -> 'variants' -> 0 ->> 'weight_source' = 'packed'
                            and (l -> 'sources' -> 0 ->> 'variant_id') = (l -> 'variants' -> 0 ->> 'id')
                       from vsev), 'each source with its option, each option with its weight');

-- The shop's title: kept where none was kept or only the name was; never over a real one.
select tests.assert_fails($$select public.worker_set_shop_titles('{}')$$, 'titles_invalid', 'an array only');
select tests.assert(public.worker_set_shop_titles(jsonb_build_array(
         jsonb_build_object('product_id', tests.id('sev'), 'title', 'Samrat | Bikaneri Sev | 400g'),
         jsonb_build_object('product_id', tests.id('oats'), 'title', 'Pro.Fitness 27g High Protein Oats By Myfitness'),
         jsonb_build_object('product_id', tests.id('hand'), 'title', 'A title for a listing added by hand'),
         jsonb_build_object('product_id', tests.id('draft'), 'title', 'x'))) = 2,
       'two kept (the name-only one replaced); none for a hand-made listing or a title too short');
select tests.assert(public.worker_set_shop_titles(jsonb_build_array(
         jsonb_build_object('product_id', tests.id('sev'), 'title', 'Something else entirely'))) = 0,
       'a kept title is never replaced');

-- The name: food only, only while it is still the name read.
select tests.assert_fails($$select public.worker_set_food_names('{}')$$, 'names_invalid', 'an array only');
select tests.assert(public.worker_set_food_names(jsonb_build_array(
         jsonb_build_object('product_id', tests.id('sev'), 'from', 'Samrat', 'to', 'Samrat Bikaneri Sev'),
         jsonb_build_object('product_id', tests.id('oats'), 'from', 'An older name', 'to', 'Pro.Fitness Oats'),
         jsonb_build_object('product_id', tests.id('draft'), 'from', 'VS draft', 'to', 'See www.shop.in'),
         jsonb_build_object('product_id', tests.id('p_live'), 'from', (select name from public.products where id = tests.id('p_live')),
                            'to', 'A clothing name'))) = 1,
       'only the food listing whose name is still the one read; never a link, never clothing');
reset role;
select tests.assert((select name = 'Samrat Bikaneri Sev' and shop_title = 'Samrat | Bikaneri Sev | 400g'
                       from public.products where id = tests.id('sev')), 'the sev has its name and its shop''s title');
select tests.assert((select name = 'Pro.Fitness 27g High Protein Oats' from public.products where id = tests.id('oats')),
                    'a name changed since it was read stays');
rollback;

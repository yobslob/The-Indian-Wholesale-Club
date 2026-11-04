-- The description redo (migration 20261107090000, D-178): the worker reads the listings whose words are still to do
-- (not placeholders, archived ones or empty ones), pages through them, and sets new words only while the listing
-- still has the words it read and no mark; a price or a link never goes in. Nobody else can.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

update public.products set summary = 'Shop line', description = 'Soft cotton kurta. MRP Rs. 999, 20% off!',
                           shop_title = 'Brandy Women Kurta', source_site = 'amazon.in'
 where id = tests.id('p_live');
update public.products set description = 'A draft piece.' where id = tests.id('p_draft');
update public.products set description = 'Never planned.' where id = tests.id('p_placeholder');
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status,
                             description)
values ('dr-food', 'DR bhujia', 'food', tests.id('region'), tests.id('cat_food'), 900, 'draft',
        'Crunchy bhujia, 200 g.'),
       ('dr-empty', 'DR empty', 'food', tests.id('region'), tests.id('cat_food'), 900, 'draft', ''),
       ('dr-gone', 'DR gone', 'food', tests.id('region'), tests.id('cat_food'), 900, 'archived',
        'Archived words.');
select tests.remember('food', (select id from public.products where slug = 'dr-food'));

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails($$select public.worker_description_plan()$$, 'worker_only', 'an admin cannot plan');
select tests.assert_fails(format($$select public.worker_description_set(%L, 'x', 'a', 'b', 'rewritten')$$,
                                 tests.id('p_live')), 'worker_only', 'an admin cannot set words');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format($$select public.worker_description_set(%L, 'x', 'a', 'b', 'rewritten')$$,
                                 tests.id('p_live')), 'worker_only', 'a customer cannot set words');
set local role anon;
select tests.assert_fails($$select public.worker_description_plan()$$, '42501', 'a visitor cannot plan');

set local role authenticated;
select tests.act_as(tests.id('worker'));
create temp table plan_all on commit drop as select public.worker_description_plan() as doc;
select tests.assert((select jsonb_array_length(doc) from plan_all) = 3,
                    'every type: the live and draft listings and the food (not the placeholder, empty or archived)');
create temp table live_l on commit drop as
  select l from plan_all, jsonb_array_elements(doc) l where l ->> 'product_id' = tests.id('p_live')::text;
select tests.assert((select l ->> 'shop' = 'Amazon India' and l ->> 'shop_title' = 'Brandy Women Kurta'
                            and l -> 'attributes' ->> 'care' = 'Hand wash' and l ->> 'type' = 'clothing'
                            and l ->> 'made_in' = 'India'
                       from live_l), 'what the words are checked against comes along');
select tests.assert(jsonb_array_length(public.worker_description_plan('food')) = 1, 'one type');
select tests.assert(jsonb_array_length(public.worker_description_plan(null, null, 2)) = 2, 'a page');
select tests.assert(jsonb_array_length(public.worker_description_plan(null,
                      (select (max(l ->> 'product_id'))::uuid from plan_all, jsonb_array_elements(doc) l))) = 0,
                    'paging: nothing at or before the last id read');

-- New words only as read, never a price or a link.
create temp table live_hash on commit drop as select l ->> 'hash' as h from live_l;
select tests.assert_fails(format($$select public.worker_description_set(%L, %L, 'a', 'b', 'mine')$$,
                                 tests.id('p_live'), (select h from live_hash)), 'bad_redo', 'a known mark only');
select tests.assert_fails(format($$select public.worker_description_set(%L, %L, 'A kurta', 'Now Rs. 499', 'rewritten')$$,
                                 tests.id('p_live'), (select h from live_hash)), 'price_or_link', 'no price');
select tests.assert_fails(format($$select public.worker_description_set(%L, %L, 'A kurta', 'See www.shop.in', 'edited')$$,
                                 tests.id('p_live'), (select h from live_hash)), 'price_or_link', 'no link');
select tests.assert_fails(format($$select public.worker_description_set(%L, %L, repeat('a', 301), 'b', 'rewritten')$$,
                                 tests.id('p_live'), (select h from live_hash)), 'too_long', 'a summary fits its column');
select tests.assert(not public.worker_description_set(tests.id('p_live'), 'not-the-hash', 'A kurta', 'Soft.',
                                                      'rewritten'), 'words changed since they were read stay');
select tests.assert(public.worker_description_set(tests.id('p_live'), (select h from live_hash),
                      'A soft kurta for long days.', E'Soft cotton.\n\n• Care: Hand wash', 'rewritten'),
                    'the new words go in');
select tests.assert(not public.worker_description_set(tests.id('p_live'), (select h from live_hash), 'Again', 'Again',
                                                      'edited'), 'a listing done once is not done again');
select tests.assert(public.worker_description_set(tests.id('food'),
                      public.worker_description_plan('food') -> 0 ->> 'hash', '', '  ', 'edited'),
                    'empty words are allowed (nothing worth keeping)');
reset role;
select tests.assert((select summary = 'A soft kurta for long days.' and description = E'Soft cotton.\n\n• Care: Hand wash'
                            and description_redo = 'rewritten' from public.products where id = tests.id('p_live')),
                    'the listing has the new words and the mark');
select tests.assert((select summary is null and description is null and description_redo = 'edited'
                       from public.products where id = tests.id('food')), 'empty words are stored as none');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(jsonb_array_length(public.worker_description_plan()) = 1, 'done listings leave the plan');

-- Customers never see the mark.
select tests.act_as(tests.id('cust_a'));
select tests.assert(not exists (select 1 from information_schema.columns
                                 where table_schema = 'public' and table_name like 'store\_%'
                                   and column_name = 'description_redo'),
                    'no store view has the redo mark');
rollback;

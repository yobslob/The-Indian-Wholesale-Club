-- The photo redo (migrations 20261102090000, D-163, and 20261103090000, D-164): the worker reads the listings with
-- photos still to do (every stored photo; clothing's vendor AI ones excepted; kids' pieces too), sets a new path,
-- `fresh` or `kept` only while the row is as it read it, puts a home scene first with the plain photo second, removes
-- a photo while the listing keeps another, and learns which stored photos are still shown. Nobody else can.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

insert into public.house_models (slug, label, wears, front_path, back_path)
values ('pr-model', 'PR model', 'women', 'house-models/pr-model/front.jpg', 'house-models/pr-model/back.jpg');
insert into public.categories (product_type, slug, name, default_weight_g)
values ('home', 'pr-decor', 'PR decor', 900) returning tests.remember('cat_home', id);
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, wears)
values ('pr-kids', 'PR kids kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 900,
        'draft', 'kids'),
       ('pr-food', 'PR bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft', null),
       ('pr-home', 'PR toran', 'home', tests.id('region'), tests.id('cat_home'), tests.id('vendor'), 900, 'draft', null);
select tests.remember('kids', (select id from public.products where slug = 'pr-kids'));
select tests.remember('food', (select id from public.products where slug = 'pr-food'));
select tests.remember('home', (select id from public.products where slug = 'pr-home'));
insert into public.product_media (product_id, storage_path, sort_order, is_primary, is_ai)
values (tests.id('p_live'), 'products/' || tests.id('p_live') || '/s/a.jpg', 0, true, false),
       (tests.id('p_live'), 'products/' || tests.id('p_live') || '/s/b.png', 1, false, false),
       (tests.id('p_live'), 'products/' || tests.id('p_live') || '/s/ai.jpg', 2, false, true),
       (tests.id('p_live'), 'products/' || tests.id('p_live') || '/old.jpg', 3, false, false),
       (tests.id('kids'), 'products/' || tests.id('kids') || '/s/k.jpg', 0, true, false),
       (tests.id('food'), 'products/' || tests.id('food') || '/s/f1.jpg', 0, true, false),
       (tests.id('food'), 'products/' || tests.id('food') || '/s/f2.jpg', 1, false, false),
       (tests.id('home'), 'products/' || tests.id('home') || '/s/h1.jpg', 0, false, false),
       (tests.id('home'), 'products/' || tests.id('home') || '/s/h2.jpg', 1, false, false);
select tests.remember('a', (select id from public.product_media where storage_path like '%/s/a.jpg'));
select tests.remember('b', (select id from public.product_media where storage_path like '%/s/b.png'));
select tests.remember('f1', (select id from public.product_media where storage_path like '%/s/f1.jpg'));
select tests.remember('h1', (select id from public.product_media where storage_path like '%/s/h1.jpg'));
select tests.remember('h2', (select id from public.product_media where storage_path like '%/s/h2.jpg'));
select tests.remember('f2', (select id from public.product_media where storage_path like '%/s/f2.jpg'));
select tests.remember('k', (select id from public.product_media where storage_path like '%/s/k.jpg'));

-- Only the worker account.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails($$select public.worker_photo_redo_plan('clothing')$$, 'worker_only', 'an admin cannot plan');
select tests.assert_fails($$select public.worker_photo_redo_set(tests.id('a'), 'x', null, 'kept')$$, 'worker_only',
                          'an admin cannot set a photo');
select tests.assert_fails($$select public.worker_photo_stems_in_use('{x}')$$, 'worker_only',
                          'an admin cannot ask which photos are shown');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails($$select public.worker_photo_redo_scene(tests.id('h1'), 'x', 'y', '')$$, 'worker_only',
                          'a customer cannot add a scene');

select tests.act_as(tests.id('worker'));
create temp table plan_c on commit drop as select public.worker_photo_redo_plan('clothing') as doc;
select tests.assert((select doc -> 'house_models' @> '[{"slug": "pr-model", "wears": "women"}]' from plan_c),
                    'the house models come along');
create temp table live_c on commit drop as
  select l from plan_c, jsonb_array_elements(doc -> 'listings') l where l ->> 'product_id' = tests.id('p_live')::text;
select tests.assert((select jsonb_array_length(doc -> 'listings') from plan_c) = 2,
                    'clothing: the live listing and the kids'' piece (the draft has no photos)');
select tests.assert((select jsonb_array_length(l -> 'photos') from live_c) = 2,
                    'clothing: every stored photo but the vendor AI one');
select tests.assert((select (l -> 'photos' -> 0 ->> 'main')::boolean from live_c), 'the main photo comes first');
select tests.assert((select l ->> 'wears' from live_c) = 'women', 'who wears it comes along');
select tests.assert(jsonb_array_length(public.worker_photo_redo_plan('clothing',
                      greatest(tests.id('p_live'), tests.id('kids'))) -> 'listings') = 0,
                    'paging: nothing at or before the last id read');
select tests.assert(jsonb_array_length(public.worker_photo_redo_plan('food') -> 'listings' -> 0 -> 'photos') = 2
                    and public.worker_photo_redo_plan('food') -> 'listings' -> 0 -> 'photos' -> 0 ->> 'id'
                        = tests.id('f1')::text, 'food: every photo, the main one first');
select tests.assert(public.worker_photo_redo_plan('home') -> 'listings' -> 0 -> 'photos' -> 0 ->> 'id'
                    = tests.id('h1')::text, 'home: the first photo when none is primary');

-- A new path, only as read and only for the listing's type.
select tests.assert_fails(format($$select public.worker_photo_redo_set(%L, %L, %L, 'food')$$, tests.id('a'),
                                 'products/' || tests.id('p_live') || '/s/a.jpg',
                                 'products/' || tests.id('p_live') || '/s/n.jpg'),
                          'redo_not_for_type', 'a clothing photo is not a food photo');
select tests.assert_fails(format($$select public.worker_photo_redo_set(%L, %L, %L, 'face')$$, tests.id('a'),
                                 'products/' || tests.id('p_live') || '/s/a.jpg', 'products/elsewhere/s/n.jpg'),
                          'bad_path', 'a new path stays in its listing''s folder');
select tests.assert(not public.worker_photo_redo_set(tests.id('a'), 'products/x/s/stale.jpg',
                                                     'products/' || tests.id('p_live') || '/s/n.jpg', 'face'),
                    'a photo changed meanwhile is left alone');
select tests.assert(public.worker_photo_redo_set(tests.id('a'), 'products/' || tests.id('p_live') || '/s/a.jpg',
                                                 'products/' || tests.id('p_live') || '/s/n.jpg', 'face'),
                    'the face photo is set');
select tests.assert(public.worker_photo_redo_set(tests.id('b'), 'products/' || tests.id('p_live') || '/s/b.png', null,
                                                 'kept'), 'a photo with no person is kept');
select tests.assert(not public.worker_photo_redo_set(tests.id('a'), 'products/' || tests.id('p_live') || '/s/n.jpg',
                                                     'products/' || tests.id('p_live') || '/s/n2.jpg', 'face'),
                    'a done photo is not done twice');
select tests.assert(not (public.worker_photo_redo_plan('clothing') -> 'listings')
                          @> jsonb_build_array(jsonb_build_object('product_id', tests.id('p_live'))),
                    'a listing whose photos are all done leaves the plan');
select tests.assert(public.worker_photo_redo_set(tests.id('f1'), 'products/' || tests.id('food') || '/s/f1.jpg',
                                                 'products/' || tests.id('food') || '/s/f9.jpg', 'food'),
                    'the food photo is set');
select tests.assert(public.worker_photo_redo_set(tests.id('f2'), 'products/' || tests.id('food') || '/s/f2.jpg',
                                                 'products/' || tests.id('food') || '/s/f8.jpg', 'fresh'),
                    'a refreshed photo, for any type');

-- A photo removed: only while the listing keeps another, and only as it was read.
select tests.assert(not public.worker_photo_redo_drop(tests.id('k'), 'products/' || tests.id('kids') || '/s/k.jpg'),
                    'a listing''s only photo is never removed');
select tests.assert(not public.worker_photo_redo_drop(tests.id('f1'), 'products/' || tests.id('food') || '/s/f9.jpg'),
                    'a done photo is not removed');

-- Home: the scene first, the plain photo second.
select tests.assert(public.worker_photo_redo_scene(tests.id('h2'), 'products/' || tests.id('home') || '/s/h2.jpg',
                                                   'products/' || tests.id('home') || '/s/s.jpg', 'x') is null,
                    'only the main photo gets a scene');
select tests.remember('scene', public.worker_photo_redo_scene(tests.id('h1'),
                                 'products/' || tests.id('home') || '/s/h1.jpg',
                                 'products/' || tests.id('home') || '/s/s.jpg', 'Toran on a door'));
reset role;
select tests.assert(public._main_photo(tests.id('home')) = tests.id('scene'), 'the scene is the main photo');
select tests.assert((select array_agg(storage_path order by sort_order) from public.product_media
                      where product_id = tests.id('home'))
                    = array['products/' || tests.id('home') || '/s/s.jpg', 'products/' || tests.id('home') || '/s/h1.jpg',
                            'products/' || tests.id('home') || '/s/h2.jpg'], 'then the plain photo, then the rest');
select tests.assert((select redo from public.product_media where id = tests.id('h1')) = 'kept', 'the plain one is kept');
set local role authenticated;
select tests.act_as(tests.id('worker'));
select tests.assert(public.worker_photo_redo_drop(tests.id('h2'), 'products/' || tests.id('home') || '/s/h2.jpg'),
                    'a photo is removed while the listing keeps another');
select tests.assert(jsonb_array_length(public.worker_photo_redo_plan('home') -> 'listings') = 0,
                    'a listing whose photos are all done leaves the plan');

-- Which stored photos are still shown.
select tests.assert(public.worker_photo_stems_in_use(array['products/' || tests.id('p_live') || '/s/a',
                                                           'products/' || tests.id('p_live') || '/s/n',
                                                           'products/' || tests.id('p_live') || '/s/b'])
                    @> array['products/' || tests.id('p_live') || '/s/n', 'products/' || tests.id('p_live') || '/s/b']
                    and not 'products/' || tests.id('p_live') || '/s/a'
                        = any(public.worker_photo_stems_in_use(array['products/' || tests.id('p_live') || '/s/a'])),
                    'the replaced photo is no longer shown; the new and kept ones are');

-- Customers never see the mark.
select tests.act_as(tests.id('cust_a'));
select tests.assert(not exists (select 1 from information_schema.columns
                                 where table_schema = 'public' and table_name like 'store\_%' and column_name = 'redo'),
                    'no store view has the redo mark');
rollback;

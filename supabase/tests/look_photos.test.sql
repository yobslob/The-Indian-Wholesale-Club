-- D-194, migration 20261112090000: the worker functions behind `pnpm sourcing looks`. The plan finds live listings with
-- a look without a photo; a look's photos go in after the others, never as the main photo and within their limits; a
-- shared photo can be tagged and untagged; undo removes only tagged photos that aren't the main one. Nobody else can.
begin;
select tests.setup();
select tests.create_user('worker', 'worker@example.test');
update public.profiles set role = 'worker' where id = tests.id('worker');

-- p_live gets two colours in two sizes each, a third colour with a photo, and a source page.
update public.products set source_url = 'https://www.amazon.in/dp/B000000001', source_site = 'amazon.in' where id = tests.id('p_live');
insert into public.product_variants (product_id, sku, label, options, qty_listed)
values (tests.id('p_live'), 'L-N-S', 'Navy · S', '{"colour": "Navy", "size": "S"}', 3),
       (tests.id('p_live'), 'L-N-M', 'Navy · M', '{"colour": "Navy", "size": "M"}', 3),
       (tests.id('p_live'), 'L-R-S', 'Red · S', '{"colour": "Red", "size": "S"}', 3),
       (tests.id('p_live'), 'L-R-M', 'Red · M', '{"colour": "Red", "size": "M"}', 3);
select tests.remember('navy_s', (select id from public.product_variants where sku = 'L-N-S'));
select tests.remember('navy_m', (select id from public.product_variants where sku = 'L-N-M'));
select tests.remember('red_m', (select id from public.product_variants where sku = 'L-R-M'));
update public.product_variants set is_active = false where id in (tests.id('v_live'), tests.id('v_live2'));
insert into public.product_media (product_id, storage_path, sort_order, is_primary)
values (tests.id('p_live'), 'products/' || tests.id('p_live') || '/s/main.jpg', 0, true),
       (tests.id('p_live'), 'products/' || tests.id('p_live') || '/s/two.jpg', 1, false);
select tests.remember('main', (select id from public.product_media where storage_path = 'products/' || tests.id('p_live') || '/s/main.jpg'));
select tests.remember('two', (select id from public.product_media where storage_path = 'products/' || tests.id('p_live') || '/s/two.jpg'));

-- Nobody but the worker.
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails($$select public.worker_look_photo_plan('clothing')$$, 'worker_only', 'a customer has no plan');
select tests.assert_fails(format($$select public.worker_look_photo_tag(%L, %L, %L)$$, tests.id('p_live'), tests.id('two'), tests.id('navy_s')), 'worker_only', 'a customer cannot tag');
select tests.assert_fails(format($$select public.worker_look_photos_undo(array[%L]::uuid[])$$, tests.id('two')), 'worker_only', 'a customer cannot undo');
set local role anon;
select tests.assert_fails($$select public.worker_look_photo_plan('clothing')$$, 'permission denied', 'a visitor has no plan');

set local role authenticated;
select tests.act_as(tests.id('worker'));

-- The plan: the live listing, its photos and variants; no placeholder, nothing of another type.
select tests.assert((select count(*) = 1 from jsonb_array_elements(public.worker_look_photo_plan('clothing') -> 'listings')), 'one live listing has looks');
select tests.assert((public.worker_look_photo_plan('clothing') -> 'listings' -> 0 ->> 'id')::uuid = tests.id('p_live'), 'that listing');
select tests.assert(jsonb_array_length(public.worker_look_photo_plan('clothing') -> 'listings' -> 0 -> 'variants') = 4, 'its options on sale');
select tests.assert(jsonb_array_length(public.worker_look_photo_plan('clothing') -> 'listings' -> 0 -> 'photos') = 2, 'its photos');
select tests.assert((public.worker_look_photo_plan('clothing') -> 'listings' -> 0 -> 'photos' -> 0 ->> 'is_primary')::boolean, 'main photo first');
select tests.assert(jsonb_array_length(public.worker_look_photo_plan('food') -> 'listings') = 0, 'none of another type');
select tests.assert(jsonb_array_length(public.worker_look_photo_plan('clothing', tests.id('p_live')) -> 'listings') = 0, 'paged after an id');

-- Adding: after the others, not the main photo, tagged.
select tests.assert(jsonb_array_length(public.worker_look_photos_add(tests.id('p_live'), jsonb_build_array(jsonb_build_object(
  'path', 'products/' || tests.id('p_live') || '/s/red.jpg', 'variant_id', tests.id('red_m'), 'alt_text', 'Red'
)))) = 1, 'a new photo');
reset role;
select tests.remember('red_photo', (select id from public.product_media where storage_path = 'products/' || tests.id('p_live') || '/s/red.jpg'));
select tests.assert((select sort_order = 2 and not is_primary and variant_id = tests.id('red_m') from public.product_media where id = tests.id('red_photo')), 'after the others, never the main photo');
set local role authenticated;
select tests.act_as(tests.id('worker'));

select tests.assert_fails(format($$select public.worker_look_photos_add(%L, %L::jsonb)$$, tests.id('p_live'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_draft') || '/s/x.jpg', 'variant_id', tests.id('red_m')))), 'media_invalid', 'another listing''s folder');
select tests.assert_fails(format($$select public.worker_look_photos_add(%L, %L::jsonb)$$, tests.id('p_live'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/x.jpg', 'variant_id', tests.id('red_m')))), 'media_invalid', 'not in the photo store');
select tests.assert_fails(format($$select public.worker_look_photos_add(%L, %L::jsonb)$$, tests.id('p_live'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/s/x.jpg', 'variant_id', tests.id('v_placeholder')))), 'variant_not_on_listing', 'another listing''s option');
select tests.assert_fails(format($$select public.worker_look_photos_add(%L, %L::jsonb)$$, tests.id('p_placeholder'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_placeholder') || '/s/x.jpg', 'variant_id', tests.id('v_placeholder')))), 'product_not_found', 'not a placeholder');

-- Two photos a look at most, whichever size each is tagged to.
select public.worker_look_photos_add(tests.id('p_live'), jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/s/n1.jpg', 'variant_id', tests.id('navy_s'))));
select public.worker_look_photos_add(tests.id('p_live'), jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/s/n2.jpg', 'variant_id', tests.id('navy_m'))));
select tests.assert_fails(format($$select public.worker_look_photos_add(%L, %L::jsonb)$$, tests.id('p_live'),
  jsonb_build_array(jsonb_build_object('path', 'products/' || tests.id('p_live') || '/s/n3.jpg', 'variant_id', tests.id('navy_s')))), 'look_has_enough_photos', 'a third photo of a look');

-- Every look has a photo now, so the plan has nothing left here.
select tests.assert(jsonb_array_length(public.worker_look_photo_plan('clothing') -> 'listings') = 0, 'nothing left to do');

-- Tagging: only an untagged photo, only this listing's option; null takes it off.
select tests.assert(public.worker_look_photo_tag(tests.id('p_live'), tests.id('main'), tests.id('navy_s')), 'the main photo may be a look''s');
select tests.assert(not public.worker_look_photo_tag(tests.id('p_live'), tests.id('main'), tests.id('red_m')), 'a tagged photo stays');
select tests.assert_fails(format($$select public.worker_look_photo_tag(%L, %L, %L)$$, tests.id('p_live'), tests.id('two'), tests.id('v_placeholder')), 'variant_not_on_listing', 'another listing''s option');
select tests.assert(public.worker_look_photo_tag(tests.id('p_live'), tests.id('main'), null), 'the tag comes off');
select tests.assert(not public.worker_look_photo_tag(tests.id('p_live'), tests.id('main'), null), 'nothing to take off');

-- Undo: the tagged photo goes and answers its path; a shared photo and the main photo stay.
select tests.assert(public.worker_look_photo_tag(tests.id('p_live'), tests.id('main'), tests.id('navy_s')), 'tagged again');
select tests.assert((public.worker_look_photos_undo(array[tests.id('red_photo'), tests.id('main'), tests.id('two')]))[1] like '%/s/red.jpg', 'its path comes back');
reset role;
select tests.assert((select count(*) = 0 from public.product_media where id = tests.id('red_photo')), 'the added photo is gone');
select tests.assert((select count(*) = 2 from public.product_media where id in (tests.id('main'), tests.id('two'))), 'the main and shared photos stay');

rollback;

-- D-203, Cook at home (docs/plan-recipes.md §6): recipes and their kits.
begin;
select tests.setup();

-- Two food listings: one in stock, one sold out
do $$
declare v_id uuid;
begin
  insert into public.products (slug, name, product_type, region_id, category_id, price_cents, shop_price_paise,
                               origin_town, status)
  values ('test-masala', 'Test pav bhaji masala', 'food', tests.id('region'), tests.id('cat_food'), 399, 9000,
          'Secret Town', 'live') returning id into v_id;
  perform tests.remember('p_masala', v_id);
  insert into public.product_variants (product_id, sku, label, qty_listed) values (v_id, 'TEST-MAS-1', '100 g', 5)
    returning id into v_id;
  perform tests.remember('v_masala', v_id);
  insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status)
  values ('test-dal', 'Test toor dal', 'food', tests.id('region'), tests.id('cat_food'), 250, 'live')
    returning id into v_id;
  perform tests.remember('p_dal', v_id);
  insert into public.product_variants (product_id, sku, label, qty_listed) values (v_id, 'TEST-DAL-1', '500 g', 0)
    returning id into v_id;
  perform tests.remember('v_dal', v_id);

  insert into public.recipes (slug, name, region_id, kind, blurb, steps)
  values ('test-pav-bhaji', 'Test pav bhaji', tests.id('region'), 'dinner', 'Test line',
          '[{"text": "Boil the vegetables.", "minutes": 15}, {"text": "Mash and fry.", "minutes": null}]')
  returning id into v_id;
  perform tests.remember('r_live', v_id);
  insert into public.recipe_ingredients (recipe_id, sort, label, amount, source, variant_id) values
    (v_id, 1, 'Pav bhaji masala', '2 tbsp', 'iwc', tests.id('v_masala')),
    (v_id, 2, 'Toor dal', '1 cup', 'iwc', tests.id('v_dal')),
    (v_id, 3, 'Butter', '3 tbsp', 'local', null);
end $$;

select tests.assert(
  (select product_id = tests.id('p_masala') from public.recipe_ingredients where variant_id = tests.id('v_masala')),
  'an IWC line takes its product from its option');

-- The publish rule
select tests.assert_fails(
  format($q$update public.recipes set status = 'live' where id = %L$q$, tests.id('r_live')),
  'words_not_approved', 'publish refuses unapproved words');
select tests.assert_fails(
  format($q$update public.recipes set status = 'live', content_status = 'approved' where id = %L$q$, tests.id('r_live')),
  'no_photo', 'publish refuses a recipe without a photo');
insert into public.recipe_ingredients (recipe_id, label, source) values (tests.id('r_live'), 'Kasuri methi', 'iwc');
select tests.assert_fails(
  format($q$update public.recipes set status = 'live', content_status = 'approved', photo_path = 's/r.avif'
            where id = %L$q$, tests.id('r_live')),
  'line_without_live_listing', 'publish refuses an IWC line without a listing (one waiting for Blinkit)');
delete from public.recipe_ingredients where label = 'Kasuri methi';
update public.recipes set status = 'live', content_status = 'approved', photo_path = 's/r.avif'
where id = tests.id('r_live');
select tests.assert((select published_at is not null from public.recipes where id = tests.id('r_live')),
  'a ready recipe publishes');
select tests.assert_fails(
  $q$insert into public.recipes (slug, name, kind, status, content_status, photo_path)
     values ('test-straight-live', 'Straight live', 'snacks', 'live', 'approved', 's/x.avif')$q$,
  'no_iwc_line', 'a recipe can''t be created live');

-- Line rules
select tests.assert_fails(
  format($q$insert into public.recipe_ingredients (recipe_id, label, source, variant_id)
            values (%L, 'Onion', 'local', %L)$q$, tests.id('r_live'), tests.id('v_masala')),
  'recipe_ingredients_local_has_no_listing', 'a local line can''t carry a listing');
select tests.assert_fails(
  format($q$insert into public.recipe_ingredients (recipe_id, label, source, variant_id)
            values (%L, 'A kurta', 'iwc', %L)$q$, tests.id('r_live'), tests.id('v_live')),
  'recipe_line_not_food', 'an IWC line can''t point at a non-food listing');
select tests.assert_fails(
  $q$insert into public.recipes (slug, name, kind, steps) values ('test-bad-steps', 'Bad', 'snacks', '[{"minutes": 3}]')$q$,
  'recipes_steps_shape', 'a step needs its words');

-- Customers read the store functions only
set local role anon;
select tests.assert_fails('select * from public.recipes', '42501', 'INV-1: visitors can''t read recipes');
select tests.assert_fails('select * from public.recipe_ingredients', '42501', 'INV-1: visitors can''t read lines');
select tests.assert(
  (select (r ->> 'kit_cents')::int = 399 and (r ->> 'kit_count')::int = 1
   from jsonb_array_elements(public.store_recipes()) r where r ->> 'slug' = 'test-pav-bhaji'),
  'the kit is the available pieces'' store prices; the sold-out one drops out');
select tests.assert(
  (select count(*) = 3 from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines')),
  'a recipe page shows every line');
select tests.assert(
  (select not (l ->> 'available')::boolean from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l
   where l ->> 'label' = 'Toor dal'),
  'a sold-out piece shows as unavailable');
select tests.assert(
  (select l ->> 'price_cents' is null from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l
   where l ->> 'source' = 'local'),
  'a local line has no price');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_recipe('test-pav-bhaji')) k
              where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields in a recipe');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_recipes()) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields on the shelf');
select tests.assert(jsonb_array_length(public.store_recipes('sweets')) = 0, 'the shelf filters by kind');
select tests.assert(public.store_home() -> 'recipe' = 'null'::jsonb, 'Home has no recipe until one is pinned');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_pin_recipe(null)', 'admin_only', 'customers can''t pin');
select tests.assert(not exists (select 1 from public.recipes), 'RLS: a customer sees no recipe rows');
select tests.act_as(tests.id('admin'));
update public.recipes set status = 'draft' where id = tests.id('r_live');
update public.recipes set status = 'live' where id = tests.id('r_live');
select tests.assert((select status = 'live' from public.recipes where id = tests.id('r_live')),
  'the admin publishes through RLS (the guard runs as its owner)');
select tests.assert(public.admin_recipe_blockers(tests.id('r_live')) = '{}', 'nothing blocks a ready recipe');
select public.admin_pin_recipe(tests.id('r_live'));
select tests.assert(
  (select count(*) = 1 from public.admin_recipe_matches('test pav bhaji')), 'Match finds a live, in-stock food option');
select tests.assert(
  (select count(*) = 0 from public.admin_recipe_matches('test toor dal')), 'Match skips a sold-out option');
create temp table missing_before on commit drop as select public.admin_recipes_missing_piece() as n;
reset role;
update public.product_variants set qty_listed = 5 where id = tests.id('v_dal');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.admin_recipes_missing_piece() = (select n - 1 from missing_before),
  'Today counts a live recipe with a sold-out piece');
reset role;
update public.product_variants set qty_listed = 0 where id = tests.id('v_dal');

set local role anon;
select tests.assert((public.store_home() -> 'recipe' ->> 'kit_cents')::int = 399, 'the pinned recipe is on Home');
reset role;

-- Hidden: drafts, unapproved words, archived, placeholders outside dev, and a kit with nothing to sell
update public.recipes set content_status = 'draft' where id = tests.id('r_live');
set local role anon;
select tests.assert(public.store_recipe('test-pav-bhaji') is null, 'unapproved words hide a live recipe');
reset role;
update public.recipes set content_status = 'approved', is_placeholder = true where id = tests.id('r_live');
set local role anon;
select tests.assert(public.store_recipe('test-pav-bhaji') is null, 'a placeholder recipe is hidden outside dev');
reset role;
update public.recipes set is_placeholder = false where id = tests.id('r_live');
update public.product_variants set qty_listed = 0 where id = tests.id('v_masala');
set local role anon;
select tests.assert(public.store_recipe('test-pav-bhaji') is null, 'a kit with nothing in stock is hidden');
reset role;
update public.product_variants set qty_listed = 5 where id = tests.id('v_masala');
update public.recipes set status = 'archived' where id = tests.id('r_live');
select tests.assert((select home_rank is null from public.recipes where id = tests.id('r_live')),
  'an archived recipe leaves Home');
set local role anon;
select tests.assert(public.store_recipe('test-pav-bhaji') is null, 'an archived recipe is hidden');
reset role;

rollback;

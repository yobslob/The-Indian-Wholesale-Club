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
-- D-204: no photo needed, and a line still waiting for a listing doesn't hold the rest back
insert into public.recipe_ingredients (recipe_id, sort, label, source) values (tests.id('r_live'), 4, 'Kasuri methi', 'iwc');
insert into public.recipe_ingredients (recipe_id, sort, label, amount, source, variant_id, instead_of) values
  (tests.id('r_live'), 5, 'Pav bhaji masala, dry', '1 tsp', 'iwc', tests.id('v_masala'), 'Butter'),
  (tests.id('r_live'), 6, 'Toor dal, dry', '1 tsp', 'iwc', tests.id('v_dal'), 'Butter');
update public.recipes set status = 'live', content_status = 'approved' where id = tests.id('r_live');
select tests.assert((select published_at is not null and photo_path is null from public.recipes where id = tests.id('r_live')),
  'a recipe with approved words and a piece to sell publishes without a photo');
do $$
declare v_id uuid;
begin
  insert into public.recipes (slug, name, kind, content_status) values ('test-nothing', 'Nothing to sell', 'snacks', 'approved')
  returning id into v_id;
  perform tests.remember('r_nothing', v_id);
  insert into public.recipe_ingredients (recipe_id, label, source, instead_of, variant_id) values
    (v_id, 'Kasuri methi', 'iwc', null, null), (v_id, 'Masala swap', 'iwc', 'Ghee', tests.id('v_masala'));
end $$;
select tests.assert_fails(
  format($q$update public.recipes set status = 'live' where id = %L$q$, tests.id('r_nothing')),
  'no_iwc_line', 'publish refuses a recipe whose only listed piece is a swap');
select tests.assert_fails(
  format($q$insert into public.recipe_ingredients (recipe_id, label, source, instead_of) values (%L, 'Mint', 'local', 'Mint')$q$,
         tests.id('r_live')),
  'recipe_ingredients_swap_is_iwc', 'a swap is an IWC line');
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
  'the kit is the available pieces'' store prices; the sold-out one and the swaps drop out');
select tests.assert(
  (select count(*) = 5 from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines')),
  'a recipe page shows every line but a swap that can''t be bought');
select tests.assert(
  (select l ->> 'source' = 'local' from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l
   where l ->> 'label' = 'Kasuri methi'),
  'a line without a listing reads as one to buy locally');
select tests.assert(
  (select l ->> 'instead_of' = 'Butter' and (l ->> 'available')::boolean
   from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l where l ->> 'label' = 'Pav bhaji masala, dry'),
  'a swap says what it stands in for');
select tests.assert(
  (select not (l ->> 'available')::boolean from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l
   where l ->> 'label' = 'Toor dal'),
  'a sold-out piece shows as unavailable');
select tests.assert(
  (select l ->> 'price_cents' is null from jsonb_array_elements(public.store_recipe('test-pav-bhaji') -> 'lines') l
   where l ->> 'label' = 'Butter'),
  'a local line has no price');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_recipe('test-pav-bhaji')) k
              where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields in a recipe');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_recipes()) k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields on the shelf');
select tests.assert(jsonb_array_length(public.store_recipes('sweets')) = 0, 'the shelf filters by kind');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.store_home() -> 'recipes') c where c ->> 'slug' = 'test-pav-bhaji'),
  'Home''s row lists the live recipes');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_home() -> 'recipes') k where k = any (tests.forbidden_keys())),
  'INV-1: no operations fields in Home''s row');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_pin_recipe(null)', 'admin_only', 'customers can''t pin');
select tests.assert_fails('select public.admin_recipes_publish_all()', 'admin_only', 'customers can''t publish');
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
-- Publish all (D-204): the cheapest in-stock match fills an empty line, the words are approved, it goes live
reset role;
do $$
declare v_id uuid;
begin
  insert into public.recipes (slug, name, kind) values ('test-poha-all', 'Test poha', 'breakfast') returning id into v_id;
  perform tests.remember('r_all', v_id);
  insert into public.recipe_ingredients (recipe_id, sort, label, source, match_words) values
    (v_id, 1, 'Masala', 'iwc', 'test pav bhaji'), (v_id, 2, 'Moon dust', 'iwc', 'zzz no such thing'),
    (v_id, 3, 'Dal', 'iwc', 'test toor dal'), (v_id, 4, 'Haji', 'iwc', 'haji');
  insert into public.recipe_ingredients (recipe_id, sort, label, source, match_words, instead_of) values
    (v_id, 5, 'Dust, dry', 'iwc', 'zzz no such thing', 'Moon dust');
  -- D-213: an import fills its drafts' lines with the cheapest listing and moves nothing
  insert into public.recipes (slug, name, kind) values ('test-import-fill', 'Test import', 'snacks') returning id into v_id;
  perform tests.remember('r_import', v_id);
  insert into public.recipe_ingredients (recipe_id, sort, label, source, match_words) values
    (v_id, 1, 'Masala', 'iwc', 'Pav-Bhaji masala'), (v_id, 2, 'Moon dust', 'iwc', 'zzz no such thing');
end $$;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.admin_recipes_fill_cheapest(array[tests.id('r_import')]) = 1,
  'D-213: after an import each draft line takes its cheapest listing');
select tests.assert(
  (select variant_id = tests.id('v_masala') from public.recipe_ingredients where recipe_id = tests.id('r_import') and label = 'Masala'),
  'D-213: words match whatever the punctuation and case');
select tests.assert(
  (select source = 'iwc' and variant_id is null from public.recipe_ingredients
   where recipe_id = tests.id('r_import') and label = 'Moon dust'),
  'D-213: an import moves nothing to the local shop');
reset role;
set local role authenticated;
select tests.act_as(tests.id('admin'));
create temp table publish_run on commit drop as select public.admin_recipes_publish_all(null, 50) as j;
select tests.assert((select j -> 'published' ? 'test-poha-all' from publish_run), 'Publish all publishes a draft');
select tests.assert(
  (select j -> 'blocked' @> '[{"slug": "test-nothing", "why": ["no_iwc_line"]}]' from publish_run),
  'Publish all leaves one with nothing to sell and says why');
select tests.assert(
  (select variant_id = tests.id('v_masala') from public.recipe_ingredients where recipe_id = tests.id('r_all') and label = 'Masala'),
  'an empty line takes the cheapest in-stock match');
select tests.assert(
  (select bool_and(source = 'local' and variant_id is null) from public.recipe_ingredients
   where recipe_id = tests.id('r_all') and label in ('Moon dust', 'Dal')),
  'D-213: a main line with no in-stock match moves to the local shop');
select tests.assert(
  (select source = 'local' from public.recipe_ingredients where recipe_id = tests.id('r_all') and label = 'Haji'),
  'D-213: a word matches at the start of a word only ("haji" is not "bhaji")');
select tests.assert(
  (select source = 'iwc' and variant_id is null from public.recipe_ingredients
   where recipe_id = tests.id('r_all') and label = 'Dust, dry'),
  'D-213: a swap with no listing stays a hidden swap');
select tests.assert((select (j ->> 'lines_local')::int >= 3 from publish_run), 'Publish all counts the lines moved to local');
select tests.assert(
  (select content_status = 'approved' and status = 'live' from public.recipes where id = tests.id('r_all')),
  'its words are approved and it is live');
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
select tests.assert(public.store_home() -> 'recipes' -> 0 ->> 'slug' = 'test-pav-bhaji', 'the pinned recipe leads Home''s row');
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

-- =============================================================================
-- DEV ONLY (INV-8). D-203, Cook at home: four placeholder recipes and the pantry pieces their kits hold, so the
-- shelf, a recipe page and Home's middle window can be seen and tested locally. Every row is fake
-- (is_placeholder = true): prices, stock, amounts and steps are DEV PLACEHOLDERS, not recipes the founder approved.
-- The photo files don't exist locally; the pages fall back to their drawings.
-- =============================================================================

insert into public.products (id, slug, name, product_type, region_id, category_id,
                             summary, price_cents, shop_price_paise, status, is_placeholder, published_at)
select p.id::uuid, p.slug, p.name, 'food', r.id, c.id,
       'Demo product for local development.', p.price_cents, p.shop_price_paise, 'live', true, now()
from (values
  ('00000000-0000-4000-8000-000000000401', 'demo-pav-bhaji-masala', 'Demo Pav Bhaji Masala', 'maharashtra', 'masala-blends', 349, 8000),
  ('00000000-0000-4000-8000-000000000402', 'demo-kasuri-methi', 'Demo Kasuri Methi', 'punjab', 'whole-spices', 249, 5000),
  ('00000000-0000-4000-8000-000000000403', 'demo-kashmiri-chilli', 'Demo Kashmiri Chilli Powder', null, 'ground-spices', 299, 6000),
  ('00000000-0000-4000-8000-000000000404', 'demo-chai-masala', 'Demo Chai Masala', null, 'masala-blends', 399, 9000),
  ('00000000-0000-4000-8000-000000000405', 'demo-assam-tea', 'Demo Assam Tea', 'assam', 'tea-and-drinks', 599, 15000),
  ('00000000-0000-4000-8000-000000000406', 'demo-thick-poha', 'Demo Thick Poha', 'madhya-pradesh', 'rice-flours-and-staples', 299, 6000),
  ('00000000-0000-4000-8000-000000000407', 'demo-rajma', 'Demo Rajma', 'punjab', 'rice-flours-and-staples', 449, 11000)
) as p (id, slug, name, region_slug, category_slug, price_cents, shop_price_paise)
left join public.regions r on r.slug = p.region_slug
join public.categories c on c.slug = p.category_slug;

insert into public.product_variants (id, product_id, sku, label, options, qty_listed, price_cents)
values
  ('00000000-0000-4000-8000-000000000411', '00000000-0000-4000-8000-000000000401', 'DEMO-PBM-100', '100 g', '{"pack": "100 g"}', 40, null),
  ('00000000-0000-4000-8000-000000000412', '00000000-0000-4000-8000-000000000401', 'DEMO-PBM-200', '200 g', '{"pack": "200 g"}', 40, 599),
  ('00000000-0000-4000-8000-000000000421', '00000000-0000-4000-8000-000000000402', 'DEMO-KM-50', '50 g', '{"pack": "50 g"}', 40, null),
  ('00000000-0000-4000-8000-000000000431', '00000000-0000-4000-8000-000000000403', 'DEMO-KC-100', '100 g', '{"pack": "100 g"}', 40, null),
  ('00000000-0000-4000-8000-000000000441', '00000000-0000-4000-8000-000000000404', 'DEMO-CM-100', '100 g', '{"pack": "100 g"}', 40, null),
  ('00000000-0000-4000-8000-000000000451', '00000000-0000-4000-8000-000000000405', 'DEMO-AT-250', '250 g', '{"pack": "250 g"}', 40, null),
  ('00000000-0000-4000-8000-000000000461', '00000000-0000-4000-8000-000000000406', 'DEMO-TP-500', '500 g', '{"pack": "500 g"}', 40, null),
  -- sold out: its recipe line shows "Not available right now" and drops out of the kit
  ('00000000-0000-4000-8000-000000000471', '00000000-0000-4000-8000-000000000407', 'DEMO-RJ-500', '500 g', '{"pack": "500 g"}', 0, null);

insert into public.recipes (id, slug, name, region_id, kind, blurb, minutes, soak_hours, serves, effort, photo_path,
                            steps, content_status, sort, is_placeholder)
select x.id::uuid, x.slug, x.name, r.id, x.kind, x.blurb, x.minutes, x.soak, x.serves, x.effort,
       'recipes/' || x.slug || '/s/main.jpg', x.steps::jsonb, 'approved', x.sort, true
from (values
  ('00000000-0000-4000-8000-000000000501', 'pav-bhaji', 'Pav Bhaji', 'maharashtra', 'snacks',
   'Demo: mashed vegetables in butter and masala, with soft pav.', 40, null::numeric, 4, 'easy',
   '[{"text": "Demo step: boil the vegetables.", "minutes": 15}, {"text": "Demo step: mash, fry with the masala.", "minutes": 20}, {"text": "Demo step: toast the pav in butter.", "minutes": 5}]', 14),
  ('00000000-0000-4000-8000-000000000502', 'masala-chai', 'Masala Chai', null, 'drinks',
   'Demo: tea boiled with milk and spice.', 10, null, 2, 'easy',
   '[{"text": "Demo step: boil water with the masala.", "minutes": 3}, {"text": "Demo step: add tea, milk and sugar.", "minutes": 7}]', 7),
  ('00000000-0000-4000-8000-000000000503', 'poha', 'Poha', 'madhya-pradesh', 'breakfast',
   'Demo: flattened rice with onion and peanuts.', 20, null, 3, 'easy',
   '[{"text": "Demo step: rinse the poha.", "minutes": 2}, {"text": "Demo step: temper and toss.", "minutes": 10}]', 44),
  ('00000000-0000-4000-8000-000000000504', 'rajma-chawal', 'Rajma Chawal', 'punjab', 'dinner',
   'Demo: kidney beans in a tomato gravy, with rice.', 60, 8, 4, 'medium',
   '[{"text": "Demo step: soak the rajma overnight.", "minutes": null}, {"text": "Demo step: pressure cook and simmer.", "minutes": 60}]', 22)
) as x (id, slug, name, region_slug, kind, blurb, minutes, soak, serves, effort, steps, sort)
left join public.regions r on r.slug = x.region_slug;

insert into public.recipe_ingredients (recipe_id, sort, label, amount, source, variant_id, match_words)
values
  ('00000000-0000-4000-8000-000000000501', 1, 'Pav bhaji masala', '2½ tbsp', 'iwc', '00000000-0000-4000-8000-000000000411', 'pav bhaji masala'),
  ('00000000-0000-4000-8000-000000000501', 2, 'Kashmiri chilli powder', '1 tsp', 'iwc', '00000000-0000-4000-8000-000000000431', 'kashmiri chilli'),
  ('00000000-0000-4000-8000-000000000501', 3, 'Kasuri methi', '1 tsp', 'iwc', '00000000-0000-4000-8000-000000000421', 'kasuri methi'),
  ('00000000-0000-4000-8000-000000000501', 4, 'Potatoes', '4', 'local', null, ''),
  ('00000000-0000-4000-8000-000000000501', 5, 'Butter', '4 tbsp', 'local', null, ''),
  ('00000000-0000-4000-8000-000000000501', 6, 'Pav', '8', 'local', null, ''),
  ('00000000-0000-4000-8000-000000000502', 1, 'Assam tea', '2 tsp', 'iwc', '00000000-0000-4000-8000-000000000451', 'assam tea'),
  ('00000000-0000-4000-8000-000000000502', 2, 'Chai masala', '½ tsp', 'iwc', '00000000-0000-4000-8000-000000000441', 'chai masala'),
  ('00000000-0000-4000-8000-000000000502', 3, 'Milk', '1 cup', 'local', null, ''),
  ('00000000-0000-4000-8000-000000000503', 1, 'Thick poha', '2 cups', 'iwc', '00000000-0000-4000-8000-000000000461', 'thick poha'),
  ('00000000-0000-4000-8000-000000000503', 2, 'Onion', '1', 'local', null, ''),
  ('00000000-0000-4000-8000-000000000504', 1, 'Rajma', '1 cup', 'iwc', '00000000-0000-4000-8000-000000000471', 'rajma'),
  ('00000000-0000-4000-8000-000000000504', 2, 'Kashmiri chilli powder', '1 tsp', 'iwc', '00000000-0000-4000-8000-000000000431', 'kashmiri chilli'),
  ('00000000-0000-4000-8000-000000000504', 3, 'Tomatoes', '3', 'local', null, '');

update public.recipes set status = 'live'
where id in ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000502',
             '00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000504');
update public.recipes set home_rank = 1 where id = '00000000-0000-4000-8000-000000000501';

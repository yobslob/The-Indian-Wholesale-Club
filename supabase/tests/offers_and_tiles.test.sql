-- D-190: which listings show a struck-through price, and Home's Shop by category tiles.
begin;
select tests.setup();
update public.pricing_settings set offer_pct = 55 where id = 1;

-- 400 listings priced by the rules, one hand-priced, one US clearance
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, published_at, is_us_stock, shop_price_paise, price_auto)
select 'of-' || n, 'Offer ' || n, 'food', null, tests.id('cat_food'), 500, 'live', now(), false, 10000, true
from generate_series(1, 400) n;
create temp table priced on commit drop as select id from public.products where slug like 'of-%';

create function pg_temp.picked() returns integer language sql as $$
  select count(*)::integer from priced where public._offer_key(id) @> '{"offer": true}'::jsonb
$$;

select tests.assert(pg_temp.picked() between 180 and 260, format('about 55%% of 400 are picked, got %s', pg_temp.picked()));
select tests.assert(
  (select bool_and(public._offer_key(id) = public._offer_key(id)) from priced),
  'a listing stays picked or not, whichever page draws it');

update public.products set price_auto = false where id in (select id from priced);
select tests.assert(pg_temp.picked() = 0, 'a hand-priced listing has no cost to work a struck price from');
update public.products set price_auto = true, is_us_stock = true where id in (select id from priced);
select tests.assert(pg_temp.picked() = 0, 'US clearance has its own price, never struck');
update public.products set is_us_stock = false where id in (select id from priced);

update public.pricing_settings set offer_pct = 0 where id = 1;
select tests.assert(pg_temp.picked() = 0, 'Settings at 0 turns it off');
update public.pricing_settings set offer_pct = 100 where id = 1;
select tests.assert(pg_temp.picked() = 400, 'at 100 every listing priced by the rules');

select tests.assert(not has_function_privilege('anon', 'public._offer_key(uuid)', 'execute'), 'the store''s reads call it, nobody else');

-- A picked card says so, in every read that draws a card; an unpicked card has no such key
select tests.assert((public._store_product_card((select id from priced limit 1)) ->> 'offer') = 'true', 'the card');
set local role anon;
select tests.assert(
  (select bool_and((c ->> 'offer') = 'true')
   from jsonb_array_elements(public.store_browse('food', null, null, 0, 24, null, null, null, 'new') -> 'products') c
   where c ->> 'slug' like 'of-%'),
  'See all''s cards');
reset role;
update public.pricing_settings set offer_pct = 0 where id = 1;
select tests.assert(not (public._store_product_card((select id from priced limit 1)) ? 'offer'), 'no key at all when it is not picked');

-- ---------------------------------------------------------------- the tiles
insert into public.categories (product_type, slug, name) values
  ('clothing', 'shirts-and-tops', 'Shirts, Tees & Tops'), ('clothing', 'kurtas', 'Kurtas & Kurtis'),
  ('food', 'ground-spices', 'Ground Spices'), ('home', 'handicrafts-and-decor', 'Handicrafts & Decor')
on conflict (slug) do nothing;
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, published_at, wears, attributes)
select 'ti-' || w.slug, 'Tile ' || w.slug, w.t::public.product_type, tests.id('region'),
       (select id from public.categories where slug = w.cat), 1000, 'live', now(), w.wears,
       '{"fibre_content": "100% cotton", "care": "Hand wash"}'
from (values ('shirt-m', 'clothing', 'shirts-and-tops', 'men'), ('top-w', 'clothing', 'shirts-and-tops', 'women'),
             ('tee-u', 'clothing', 'shirts-and-tops', 'unisex'), ('kurta-m', 'clothing', 'kurtas', 'men'),
             ('kurti-w', 'clothing', 'kurtas', 'women'), ('haldi', 'food', 'ground-spices', null),
             ('vase', 'home', 'handicrafts-and-decor', null)) w(slug, t, cat, wears);
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, upper(slug), 'One', 5, 100 from public.products where slug like 'ti-%';

set local role anon;
create temp table home on commit drop as select public.store_home() -> 'categories' as c;
reset role;
select tests.assert((select c @> '[{"name": "Shirts", "slug": "shirts-and-tops", "for": "men", "count": 2}]'::jsonb from home),
  'Shirts: men''s and unisex pieces of the shared category');
select tests.assert((select c @> '[{"name": "Tops", "slug": "shirts-and-tops", "for": "women", "count": 2}]'::jsonb from home),
  'Tops: women''s and unisex pieces of the shared category');
select tests.assert((select c @> '[{"name": "Kurtis", "slug": "kurtas", "for": "women", "count": 1}]'::jsonb from home),
  'Kurtis: women''s only');
select tests.assert((select c @> '[{"name": "Handicrafts & Decor", "slug": "handicrafts-and-decor", "count": 1}]'::jsonb from home),
  'Handicrafts & Decor keeps its own name and count');
select tests.assert((select exists (select 1 from jsonb_array_elements(c) t
                                    where t ->> 'name' = 'Gifts' and t ->> 'product_type' = 'home' and (t ->> 'whole')::boolean
                                      and (t ->> 'count')::int = (select count(*) from public.store_products where product_type = 'home'))
                     from home),
  'Gifts is all of Home & gifts');
select tests.assert((select count(*) = 1 from home, jsonb_array_elements(c) t where t ? 'whole'), 'only Gifts is a whole type');
select tests.assert((select not exists (select 1 from jsonb_array_elements(c) t where t ->> 'slug' = 'ground-spices') from home),
  'Ground Spices has no tile');

rollback;

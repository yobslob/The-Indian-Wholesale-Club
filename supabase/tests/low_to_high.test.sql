-- See all opens low to high; Clothing's default is one of each, then step up, with its finishing touches in a drawer
-- (migration 20261021090000, D-144, plan F11).
begin;
select tests.setup();

insert into public.categories (product_type, slug, name) values
  ('clothing', 'kurtas', 'Kurtas'), ('clothing', 'sarees', 'Sarees'),
  ('clothing', 'accessories', 'Accessories'), ('clothing', 'headwear', 'Turbans & Headwear')
  on conflict (slug) do nothing;
-- the cheapest prices in the database, so pieces seeded elsewhere never come between them
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, wears, attributes)
select s, s, 'clothing', tests.id('region'), (select id from public.categories where slug = c), tests.id('vendor'), cents,
       'live', now() - age, 'women', '{"fibre_content": "Cotton", "care": "Hand wash"}'
  from (values ('lh-kurta-1', 'kurtas', 3, interval '1 day'), ('lh-kurta-2', 'kurtas', 5, interval '2 days'),
               ('lh-saree-1', 'sarees', 4, interval '3 days'), ('lh-saree-2', 'sarees', 9, interval '4 days'),
               ('lh-bangles', 'accessories', 1, interval '5 days'), ('lh-turban', 'headwear', 2, interval '6 days'))
       v(s, c, cents, age);
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
select id, 'LH-' || slug, 'M', '{"size": "M"}', 2, 300 from public.products where slug like 'lh-%';

set local role anon;
create temp table lh on commit drop as
select public.store_browse('clothing', 'test-region', null, 0, 24, null, null, null, 'low') as b;
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from lh, jsonb_array_elements(b -> 'products') with ordinality x(p, n) where p ->> 'slug' like 'lh-%')
  = array['lh-kurta-1', 'lh-saree-1', 'lh-kurta-2', 'lh-saree-2'],
  'Clothing''s default: each category''s cheapest, then each one''s second cheapest');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from lh, jsonb_array_elements(b -> 'drawer') with ordinality x(p, n) where p ->> 'slug' like 'lh-%')
  = array['lh-bangles', 'lh-turban'],
  'accessories and turbans leave the list for the drawer, cheapest first');
select tests.assert(
  (select (b ->> 'drawer_total')::int >= 2 and jsonb_array_length(b -> 'drawer') <= 12
          and jsonb_array_length(b -> 'drawer') = least((b ->> 'drawer_total')::int, 12) from lh),
  '12 finishing touches for 24 cards, counted apart from the list');
select tests.assert(
  (select jsonb_array_length(public.store_browse('clothing', 'test-region', null, 0, 2, null, null, null, 'low') -> 'drawer')) = 1
  and (select jsonb_array_length(public.store_browse('clothing', 'test-region', null, 2, 2, null, null, null, 'low') -> 'drawer')) = 1
  and (public.store_browse('clothing', 'test-region', null, 0, 2, null, null, null, 'low') -> 'drawer' -> 0 ->> 'id')
   <> (public.store_browse('clothing', 'test-region', null, 2, 2, null, null, null, 'low') -> 'drawer' -> 0 ->> 'id'),
  'each Show more brings the next drawer (half as many as cards, from half the offset)');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('clothing', 'test-region', null, 0, 24, null, null, null, 'price-asc')
                               -> 'products') with ordinality x(p, n)
    where p ->> 'slug' like 'lh-%') = array['lh-bangles', 'lh-turban', 'lh-kurta-1', 'lh-saree-1', 'lh-kurta-2', 'lh-saree-2'],
  'Price: low to high stays strict, with no drawer');
select tests.assert(
  (select jsonb_array_length(b -> 'drawer') = 0 and (b ->> 'drawer_total')::int = 0
     from public.store_browse('clothing', 'test-region', 'accessories', 0, 24, null, null, null, 'low') b)
  and (public.store_browse('clothing', 'test-region', 'accessories', 0, 24, null, null, null, 'low') -> 'products' -> 0 ->> 'slug')
    = 'lh-bangles',
  'inside a category there is no drawer: plain low to high');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('clothing', 'test-region', 'kurtas', 0, 24, null, null, null, 'low')
                               -> 'products') with ordinality x(p, n)
    where p ->> 'slug' like 'lh-%') = array['lh-kurta-1', 'lh-kurta-2'],
  'one category: cheapest first');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('clothing', 'test-region') -> 'products') with ordinality x(p, n)
    where p ->> 'slug' like 'lh-%')
  = array['lh-kurta-1', 'lh-kurta-2', 'lh-saree-1', 'lh-saree-2', 'lh-bangles', 'lh-turban'],
  'no sort (the app) is still newest first, finishing touches in the list');
reset role;

rollback;

-- Who a piece is for, one spelling per size, a state's own pieces first and same-moment pieces mixed (migration
-- 20261018100000, D-140 plan F2, L2, L8).
begin;
select tests.setup();

-- Who it is for: from the name, else the category; clothing cannot go live without it.
insert into public.categories (product_type, slug, name) values ('clothing', 'sarees', 'Sarees')
  on conflict (slug) do nothing;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('wr-w', 'Women''s Anarkali Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('wr-m', 'Men Pathani Suit', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('wr-k', 'Girls Lehenga Choli', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('wr-u', 'Unisex Nehru Jacket', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft'),
       ('wr-s', 'Kanjivaram silk', 'clothing', tests.id('region'), (select id from public.categories where slug = 'sarees'),
        tests.id('vendor'), 3000, 'draft'),
       ('wr-n', 'Bootcut jeans', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft');
select tests.assert(
  (select string_agg(slug || '=' || coalesce(wears, '-'), ',' order by slug) from public.products where slug like 'wr-%')
  = 'wr-k=kids,wr-m=men,wr-n=-,wr-s=women,wr-u=unisex,wr-w=women',
  'the name says who it is for ("women''s" is not "men"), else the category (sarees: women); nothing guessed otherwise');
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
select id, 'WR-' || slug, 'M', '{"size": "M"}', 2, 400 from public.products where slug like 'wr-%';
select tests.assert_fails('update public.products set status = ''live'' where slug = ''wr-n''', 'wears_missing',
  'clothing without who it is for cannot go live');
update public.products set wears = 'men', status = 'live', published_at = now() - interval '1 day' where slug = 'wr-n';
update public.products set status = 'live', published_at = now() - interval '2 days' where slug like 'wr-%' and slug <> 'wr-n';

-- See all's For: women or men, unisex under both; kids under neither.
set local role anon;
select tests.assert(
  (select array_agg(p ->> 'slug' order by p ->> 'slug')
     from jsonb_array_elements(public.store_browse('clothing', null, null, 0, 100, null, null, null, null, 'women') -> 'products') p
    where p ->> 'slug' like 'wr-%') = array['wr-s', 'wr-u', 'wr-w'],
  'For women: women''s and unisex pieces');
select tests.assert(
  (select array_agg(p ->> 'slug' order by p ->> 'slug')
     from jsonb_array_elements(public.store_browse('clothing', null, null, 0, 100, null, null, null, null, 'men') -> 'products') p
    where p ->> 'slug' like 'wr-%') = array['wr-m', 'wr-n', 'wr-u'],
  'For men: men''s and unisex pieces');
select tests.assert(
  (select (b -> 'wears' ->> 'women')::int >= 3 and (b -> 'wears' ->> 'men')::int >= 3 from public.store_browse('clothing') b),
  'the For counts include unisex under both');
select tests.assert(
  (select (public.store_browse('clothing', null, null, 0, 24, null, null, null, null, 'kids') ->> 'total')::int
        = (public.store_browse('clothing') ->> 'total')::int),
  'no Kids filter at launch: anything but women or men is no filter');
reset role;

-- One spelling per size.
select tests.assert(public._size_norm('One Size') = 'One size' and public._size_norm('free size') = 'One size'
                    and public._size_norm('l-xl') = 'L/XL' and public._size_norm(' L / XL ') = 'L/XL'
                    and public._size_norm('0-3M') = '0-3M' and public._size_norm('xxl') = 'XXL',
  'sizes read one way: One size, L/XL, upper-case letters; kids'' ages untouched');
update public.product_variants set options = '{"size": "L-XL"}' where sku = 'WR-wr-m';
update public.product_variants set options = '{"colour": "Red"}' where sku = 'WR-wr-s';
set local role anon;
select tests.assert(
  (select (public.store_browse('clothing', null, null, 0, 24, null, null, 'L/XL') ->> 'total')::int) >= 1
  and exists (select 1 from jsonb_array_elements(public.store_browse('clothing') -> 'sizes') s where s ->> 'value' = 'L/XL')
  and not exists (select 1 from jsonb_array_elements(public.store_browse('clothing') -> 'sizes') s where s ->> 'value' = 'L-XL'),
  'L-XL shows and filters as L/XL');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.store_browse('clothing', null, null, 0, 100, null, null, 'One size') -> 'products') p
          where p ->> 'slug' = 'wr-s'),
  'a piece without a size (a saree) is One size');

-- L2: with a state, its own pieces come before newer all-India ones.
reset role;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at, wears)
values ('wr-all', 'All India newest shirt', 'clothing', null, tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft', now(), 'men');
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
select id, 'WR-all', 'M', '{"size": "M"}', 2, 400 from public.products where slug = 'wr-all';
update public.products set status = 'live', published_at = now() where slug = 'wr-all';
set local role anon;
select tests.assert(
  (select min(n) filter (where p ->> 'slug' = 'wr-all') > max(n) filter (where p ->> 'region_slug' = 'test-region')
     from jsonb_array_elements(public.store_browse('clothing', 'test-region', null, 0, 500) -> 'products') with ordinality x(p, n)),
  'See all with a state: the state''s own pieces first, then all-India');
select tests.assert(
  (select min(n) filter (where p ->> 'slug' = 'wr-all')
     from jsonb_array_elements(public.store_browse('clothing', null, null, 0, 500) -> 'products') with ordinality x(p, n)) = 1,
  'without a state, newest first as before');
reset role;

-- L8: pieces published at the same moment take turns by shop instead of A-Z.
insert into public.vendors (shop_name, region_id, status) values ('Second Shop', tests.id('region'), 'active');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, wears)
select 'wr-mix-' || v.n || '-' || i, chr(64 + i) || ' mix ' || v.n, 'clothing', tests.id('region'), tests.id('cat_clothing'),
       v.id, 3000, 'draft', 'women'
  from (select 1 as n, tests.id('vendor') as id union all
        select 2, (select id from public.vendors where shop_name = 'Second Shop')) v, generate_series(1, 4) i;
insert into public.product_variants (product_id, sku, label, options, qty_listed, weight_g)
select id, 'WR-' || slug, 'M', '{"size": "M"}', 2, 400 from public.products where slug like 'wr-mix-%';
update public.products set status = 'live', published_at = now() + interval '1 hour' where slug like 'wr-mix-%';
set local role anon;
select tests.assert(
  (select count(distinct split_part(p ->> 'slug', '-', 3)) = 2
     from jsonb_array_elements(public.store_browse('clothing', null, null, 0, 2) -> 'products') p),
  'the first two of a same-moment batch come from both shops');
reset role;

rollback;

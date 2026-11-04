-- A state's own pieces first whatever the sort (migration 20261108090500_browse_reads, founder 2026-11-03).
begin;
select tests.setup();

insert into public.categories (product_type, slug, name) values ('home', 'br-home', 'BR home');
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, published_at)
values ('br-own-cheap', 'BR own cheap', 'home', tests.id('region'), (select id from public.categories where slug = 'br-home'),
        3000, 'live', now() - interval '3 days'),
       ('br-own-dear', 'BR own dear', 'home', tests.id('region'), (select id from public.categories where slug = 'br-home'),
        6000, 'live', now() - interval '2 days'),
       ('br-india-cheapest', 'BR all-India cheapest', 'home', null, (select id from public.categories where slug = 'br-home'),
        1000, 'live', now() - interval '1 day'),
       ('br-india-dearest', 'BR all-India dearest', 'home', null, (select id from public.categories where slug = 'br-home'),
        9000, 'live', now());
insert into public.product_variants (product_id, sku, label, options, qty_listed)
select id, 'BR-' || slug, '500 g', '{"size": "500 g"}', 2 from public.products where slug like 'br-%';

set local role anon;
create temp table sorted on commit drop as
select s.sort_, array_agg(p ->> 'slug' order by n) as slugs
  from unnest(array['low', 'new', 'price-asc', 'price-desc']) s(sort_)
 cross join lateral jsonb_array_elements(
         public.store_browse('home', 'test-region', 'br-home', 0, 24, null, null, null, s.sort_) -> 'products')
         with ordinality x(p, n)
 group by s.sort_;
select tests.assert((select slugs from sorted where sort_ = 'low')
                    = array['br-own-cheap', 'br-own-dear', 'br-india-cheapest', 'br-india-dearest'],
  'low to high: the state''s own first, each half low to high');
select tests.assert((select slugs from sorted where sort_ = 'price-asc')
                    = array['br-own-cheap', 'br-own-dear', 'br-india-cheapest', 'br-india-dearest'],
  'price: low to high: the state''s own first, even with a cheaper all-India piece');
select tests.assert((select slugs from sorted where sort_ = 'price-desc')
                    = array['br-own-dear', 'br-own-cheap', 'br-india-dearest', 'br-india-cheapest'],
  'price: high to low: the state''s own first, even with a dearer all-India piece');
select tests.assert((select slugs from sorted where sort_ = 'new')
                    = array['br-own-dear', 'br-own-cheap', 'br-india-dearest', 'br-india-cheapest'],
  'newest: the state''s own first, as before');
select tests.assert(
  (select array_agg(p ->> 'slug' order by n)
     from jsonb_array_elements(public.store_browse('home', null, 'br-home', 0, 24, null, null, null, 'price-asc') -> 'products')
          with ordinality x(p, n)) = array['br-india-cheapest', 'br-own-cheap', 'br-own-dear', 'br-india-dearest'],
  'without a state, the sort alone');
select tests.assert(
  (select p ->> 'primary_image_path' is null and p ? 'primary_image_path'
     from jsonb_array_elements(public.store_browse('home', 'test-region', 'br-home') -> 'products') p
    where p ->> 'slug' = 'br-own-cheap'),
  'a card still carries its photo field (read for the page''s cards only)');
reset role;

rollback;

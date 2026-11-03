-- A state's own pieces first whatever the sort, and the 7-day set unchanged by its faster read (migration
-- 20261108090500_browse_reads, founder 2026-11-03).
begin;
select tests.setup();

insert into public.categories (product_type, slug, name) values ('home', 'br-home', 'BR home');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values ('br-own-cheap', 'BR own cheap', 'home', tests.id('region'), (select id from public.categories where slug = 'br-home'),
        tests.id('vendor'), 3000, 'live', now() - interval '3 days'),
       ('br-own-dear', 'BR own dear', 'home', tests.id('region'), (select id from public.categories where slug = 'br-home'),
        tests.id('vendor'), 6000, 'live', now() - interval '2 days'),
       ('br-india-cheapest', 'BR all-India cheapest', 'home', null, (select id from public.categories where slug = 'br-home'),
        tests.id('vendor'), 1000, 'live', now() - interval '1 day'),
       ('br-india-dearest', 'BR all-India dearest', 'home', null, (select id from public.categories where slug = 'br-home'),
        tests.id('vendor'), 9000, 'live', now());
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

-- The 7-day set, grouped now, is the one the per-listing check gave (20261023120000_seven_day_shipments).
update public.sourcing_shops set quick_delivery = true where site = 'blinkit.com';
update public.products set source_site = 'blinkit.com' where slug in ('br-own-cheap', 'br-india-cheapest');
-- a 7-day listing with a second option from a normal shop is not 7-day
insert into public.product_variants (product_id, sku, label, options, qty_listed)
select id, 'BR-x-' || slug, '1 kg', '{"size": "1 kg"}', 2 from public.products where slug = 'br-india-cheapest';
insert into public.product_sources (product_id, variant_id, site, page_url, item_url)
select v.product_id, v.id, 'amazon.in', 'https://example.test/br', 'https://example.test/br'
  from public.product_variants v where v.sku = 'BR-x-br-india-cheapest';
update public.product_variants v set source_id = (select ps.id from public.product_sources ps where ps.variant_id = v.id)
 where v.sku = 'BR-x-br-india-cheapest';
select tests.assert(
  (select array_agg(id order by id) from public._quick_listings())
  = (select array_agg(p.id order by p.id)
       from public.products p
      where p.status = 'live' and not p.is_us_stock
        and not (select s.quick_delivery_paused from public.pricing_settings s where s.id = 1)
        and exists (select 1 from public.product_variants v where v.product_id = p.id and v.is_active)
        and not exists (
          select 1 from public.product_variants v
          left join public.product_sources ps on ps.id = v.source_id
          left join public.sourcing_shops sh on sh.site = coalesce(ps.site, p.source_site)
          where v.product_id = p.id and v.is_active and not coalesce(sh.quick_delivery, false))),
  'the 7-day listings are the same set as the per-listing check');
select tests.assert(
  (select (select id from public.products where slug = 'br-own-cheap') in (select id from public._quick_listings())
      and (select id from public.products where slug = 'br-india-cheapest') not in (select id from public._quick_listings())),
  'every option from a 7-day shop: 7-day; one option from a normal shop: not');

rollback;

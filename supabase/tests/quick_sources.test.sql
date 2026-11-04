-- D-162, D-187: a listing that can be bought whole from the fast shops is bought there: when it is added, at the weekly
-- check, and through the founder's backfill (ops_quick_sources). A listing with an option sold only elsewhere stays at
-- the cheapest prices.
begin;
select tests.setup();

update public.sourcing_settings set max_delivery_days = 5 where id = 1;
create function pg_temp.bought_at(p_sku text) returns text language sql as $$
  select ps.site from public.product_variants v join public.product_sources ps on ps.id = v.source_id where v.sku = p_sku
$$;

-- Two listings found on Blinkit, each with a cheaper Amazon backup; the second also has a pack sold only on Amazon.
-- Both were settled by the old rule (the cheapest): bought on Amazon, not from a fast shop.
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status,
                             published_at, source_url, source_site, source_checked_at)
select s, s, 'food', null, tests.id('cat_food'), 500, 'live', now(),
       'https://blinkit.com/prn/x/prid/' || s, 'blinkit.com', timestamptz '2026-10-20 10:00+00'
  from (values ('qs-chips'), ('qs-mixed')) v(s);
select tests.remember('p_chips', (select id from public.products where slug = 'qs-chips'));
select tests.remember('p_mixed', (select id from public.products where slug = 'qs-mixed'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
values (tests.id('p_chips'), 'QS-CHIPS-1', '100 g', 5, 100),
       (tests.id('p_mixed'), 'QS-MIXED-1', '100 g', 5, 100),
       (tests.id('p_mixed'), 'QS-MIXED-2', '1 kg', 5, 1000);
insert into public.product_sources (product_id, variant_id, site, page_url, item_url, item_key, price_paise, in_stock,
                                    delivery_days, checked_at)
select v.product_id, v.id, x.site, x.url, x.url, x.site || '-' || v.sku, x.paise, true, x.days, now()
  from public.product_variants v
  join (values ('blinkit.com', 'https://blinkit.com/prn/x/prid/1', 10000, null::smallint),
               ('amazon.in', 'https://www.amazon.in/dp/B0QS000001', 8000, 2::smallint)) x(site, url, paise, days)
    on v.sku <> 'QS-MIXED-2' or x.site = 'amazon.in'
 where v.sku like 'QS-%';
update public.product_variants v set source_id = ps.id
  from public.product_sources ps where ps.variant_id = v.id and ps.site = 'amazon.in' and v.sku like 'QS-%';
select tests.assert(pg_temp.bought_at('QS-CHIPS-1') = 'amazon.in', 'before: bought on Amazon');

-- Customers and the runner cannot run the backfill; the founder's service key can.
select tests.assert(
  not has_function_privilege('anon', 'public.ops_quick_sources(boolean, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.ops_quick_sources(boolean, integer)', 'execute')
  and has_function_privilege('service_role', 'public.ops_quick_sources(boolean, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public._quick_sourceable(uuid)', 'execute'),
  'the backfill and its rule are not callable from the website or the app');

-- The dry run names the listing, changes nothing.
create temp table dry on commit drop as select public.ops_quick_sources(false) as r;
select tests.assert(
  (select r -> 'sample' @> jsonb_build_array(jsonb_build_object('id', tests.id('p_chips'), 'quick_price_paise', 10000))
          and not r -> 'sample' @> jsonb_build_array(jsonb_build_object('id', tests.id('p_mixed')))
          and (r ->> 'stay_normal')::int >= 1 and (r ->> 'switched')::int = 0 from dry),
  'the dry run lists the Blinkit listing, counts the mixed one as staying normal, and switches nothing');
select tests.assert(pg_temp.bought_at('QS-CHIPS-1') = 'amazon.in', 'the dry run wrote nothing');

-- The apply switches it, keeps its check date; a second apply finds nothing more.
select tests.assert((public.ops_quick_sources(true, 500) ->> 'switched')::int >= 1, 'the apply switches');
select tests.assert(
  (select ps.site = 'blinkit.com' and v.shop_price_paise = 10000
     from public.product_variants v join public.product_sources ps on ps.id = v.source_id where v.sku = 'QS-CHIPS-1')
  and pg_temp.bought_at('QS-CHIPS-1') = 'blinkit.com',
  'bought on Blinkit at Blinkit''s price');
select tests.assert(
  (select source_checked_at = timestamptz '2026-10-20 10:00+00' from public.products where id = tests.id('p_chips')),
  'its check date is kept, so the weekly check still reads the shop on time');
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-MIXED-1') and pg_temp.bought_at('QS-MIXED-1') = 'amazon.in',
  'a listing with a pack sold only elsewhere keeps the cheapest source');
select tests.assert(
  (select (r ->> 'switched')::int = 0 and not r -> 'sample' @> jsonb_build_array(jsonb_build_object('id', tests.id('p_chips')))
     from (select public.ops_quick_sources(true, 500) as r) x),
  'run again it finds nothing more (idempotent)');

-- The weekly check: Blinkit sold out → the Amazon backup takes over; back in stock → Blinkit again.
update public.product_sources set in_stock = false where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-CHIPS-1') and pg_temp.bought_at('QS-CHIPS-1') = 'amazon.in',
  'sold out on Blinkit: bought on Amazon');
update public.product_sources set in_stock = true where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(pg_temp.bought_at('QS-CHIPS-1') = 'blinkit.com', 'back in stock: Blinkit again');

-- A price held for review on the quick shop is not used.
update public.product_sources set review = 'price_rise' where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(pg_temp.bought_at('QS-CHIPS-1') = 'amazon.in', 'a held Blinkit price: the backup is used');
update public.product_sources set review = null where item_key = 'blinkit.com-QS-CHIPS-1';

-- No food days in Settings: sources go by price alone, as before D-162.
update public.pricing_settings set food_delivery_days_min = null, food_delivery_days_max = null where id = 1;
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-CHIPS-1'),
  'with no food days the cheapest shop is used');

rollback;

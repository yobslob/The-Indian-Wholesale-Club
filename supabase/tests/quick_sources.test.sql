-- D-162 (migration 20261101090000): a listing that can be bought whole from the quick-delivery shops is bought there,
-- so it keeps its 7-day tag (D-148): when it is added, at the weekly check, and through the founder's backfill
-- (ops_quick_sources). A listing with an option sold only elsewhere stays at the cheapest prices.
begin;
select tests.setup();

update public.pricing_settings set quick_delivery_days_min = 7, quick_delivery_days_max = 7, food_cleared = true where id = 1;
update public.sourcing_settings set max_delivery_days = 5 where id = 1;

-- Two listings found on Blinkit, each with a cheaper Amazon backup; the second also has a pack sold only on Amazon.
-- Both were settled by the old rule (the cheapest): bought on Amazon, so neither is a 7-day piece.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, source_url, source_site, source_checked_at)
select s, s, 'food', null, tests.id('cat_food'), tests.id('vendor'), 500, 'live', now(),
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
select tests.assert(public._quick_days(tests.id('p_chips')) is null, 'before: bought on Amazon, no 7-day tag');

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
select tests.assert(public._quick_days(tests.id('p_chips')) is null, 'the dry run wrote nothing');

-- The apply switches it, keeps its check date; a second apply finds nothing more.
select tests.assert((public.ops_quick_sources(true, 500) ->> 'switched')::int >= 1, 'the apply switches');
select tests.assert(
  (select ps.site = 'blinkit.com' and v.shop_price_paise = 10000
     from public.product_variants v join public.product_sources ps on ps.id = v.source_id where v.sku = 'QS-CHIPS-1')
  and public._quick_days(tests.id('p_chips')) = 7,
  'bought on Blinkit at Blinkit''s price: a 7-day piece');
select tests.assert(
  (select source_checked_at = timestamptz '2026-10-20 10:00+00' from public.products where id = tests.id('p_chips')),
  'its check date is kept, so the weekly check still reads the shop on time');
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-MIXED-1') and public._quick_days(tests.id('p_mixed')) is null,
  'a listing with a pack sold only elsewhere keeps the cheapest source (no 7-day promise to pay for)');
select tests.assert(
  (select (r ->> 'switched')::int = 0 and not r -> 'sample' @> jsonb_build_array(jsonb_build_object('id', tests.id('p_chips')))
     from (select public.ops_quick_sources(true, 500) as r) x),
  'run again it finds nothing more (idempotent)');

-- The weekly check: Blinkit sold out → the Amazon backup takes over; back in stock → Blinkit again.
update public.product_sources set in_stock = false where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-CHIPS-1') and public._quick_days(tests.id('p_chips')) is null,
  'sold out on Blinkit: bought on Amazon, and the 7-day tag goes (the promise stays true)');
update public.product_sources set in_stock = true where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(public._quick_days(tests.id('p_chips')) = 7, 'back in stock: Blinkit again, 7-day again');

-- A price held for review on the quick shop is not used.
update public.product_sources set review = 'price_rise' where site = 'blinkit.com' and item_key = 'blinkit.com-QS-CHIPS-1';
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(public._quick_days(tests.id('p_chips')) is null, 'a held Blinkit price: the backup is used');
update public.product_sources set review = null where item_key = 'blinkit.com-QS-CHIPS-1';

-- 7-day delivery off (no days in Settings): sources go by price alone, as before D-162.
update public.pricing_settings set quick_delivery_days_min = null, quick_delivery_days_max = null where id = 1;
select public._sourcing_settle(tests.id('p_chips'));
select tests.assert(
  (select ps.site = 'amazon.in' from public.product_variants v join public.product_sources ps on ps.id = v.source_id
    where v.sku = 'QS-CHIPS-1'),
  'with 7-day delivery off the cheapest shop is used');

rollback;

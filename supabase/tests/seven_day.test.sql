-- D-148: 7-day delivery. A listing bought only from the quick-delivery shops is a 7-day piece: its card says so, the
-- 7-day page lists it, and a bag of only such pieces gets the 7-day window at checkout and on its order (migration
-- 20261022120000). One other piece makes it a normal bag. No shop ever reaches the customer (D-003).
begin;
select tests.setup();

update public.pricing_settings
   set quick_delivery_days_min = 7, quick_delivery_days_max = 7, pilot_delivery_days_min = 12,
       pilot_delivery_days_max = 18, food_cleared = true
 where id = 1;
insert into public.categories (product_type, slug, name) values ('food', 'qd-snacks', 'Snacks')
  on conflict (slug) do nothing;

-- A crisp packet imported from Blinkit, and a biscuit with one pack on Blinkit and one on Amazon.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, source_url, source_site)
select s, s, 'food', null, (select id from public.categories where slug = 'qd-snacks'), tests.id('vendor'), cents,
       'live', now(), 'https://blinkit.com/prn/x/prid/' || s, 'blinkit.com'
  from (values ('qd-chips', 3), ('qd-biscuit', 4)) v(s, cents);
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, upper(slug), '100 g', 5, 100 from public.products where slug in ('qd-chips', 'qd-biscuit');
select tests.remember('v_chips', (select v.id from public.product_variants v join public.products p on p.id = v.product_id
                                   where p.slug = 'qd-chips'));
select tests.remember('p_biscuit', (select id from public.products where slug = 'qd-biscuit'));

select tests.assert(public._quick_days((select id from public.products where slug = 'qd-chips')) = 7,
  'a listing bought from Blinkit is a 7-day piece');
select tests.assert(public._quick_days(tests.id('p_live')) is null, 'a listing from a shop in India is not');

-- The biscuit's second pack is bought on Amazon: not every option is quick, so the listing is not.
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
values (tests.id('p_biscuit'), 'QD-BISCUIT-2', '250 g', 5, 250);
select tests.remember('v_biscuit2', (select id from public.product_variants where sku = 'QD-BISCUIT-2'));
insert into public.product_sources (product_id, variant_id, site, page_url, item_url)
values (tests.id('p_biscuit'), tests.id('v_biscuit2'), 'amazon.in', 'https://amazon.in/dp/x', 'https://amazon.in/dp/x');
update public.product_variants set source_id = (select id from public.product_sources where variant_id = tests.id('v_biscuit2'))
 where id = tests.id('v_biscuit2');
select tests.assert(public._quick_days(tests.id('p_biscuit')) is null,
  'one option bought on Amazon: not a 7-day piece');
update public.product_variants set is_active = false where id = tests.id('v_biscuit2');
select tests.assert(public._quick_days(tests.id('p_biscuit')) = 7, 'that option stopped: a 7-day piece again');

select tests.assert(
  has_function_privilege('anon', 'public.store_quick_browse(text, integer, integer)', 'execute')
  and has_function_privilege('anon', 'public.store_quick_bag(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public._quick_days(uuid)', 'execute')
  and not has_function_privilege('anon', 'public._quick_listings()', 'execute'),
  'customers read the 7-day page and bag through store_* only (D-017)');
create temp table qb on commit drop as select public.store_quick_browse() as b;
select tests.assert(
  (select array_agg(p ->> 'slug' order by p ->> 'slug') from qb, jsonb_array_elements(b -> 'products') p)
  = array['qd-biscuit', 'qd-chips'] and (select (b ->> 'days_max')::int = 7 from qb),
  'the 7-day page lists the 7-day pieces and its days');
select tests.assert((select b::text !~* 'blinkit|amazon|source' from qb), 'the 7-day page names no shop (D-003)');
select tests.assert(
  (select (public._store_product_card((select id from public.products where slug = 'qd-chips')) ->> 'quick_days')::int) = 7
  and public._store_product_card(tests.id('p_live')) ->> 'quick_days' is null,
  'the card carries the 7-day days only for a 7-day piece');
select tests.assert(
  (select bool_and((p ->> 'quick_days')::int = 7) from jsonb_array_elements(
     public.store_browse('food', null, 'qd-snacks', 0, 24, null, null, null, 'low') -> 'products') p),
  'See all''s cards carry it too');
select tests.assert(public.store_quick_bag(array[tests.id('v_chips')]) = '{"days_min": 7, "days_max": 7}'::jsonb,
  'a bag of only 7-day pieces is a 7-day bag');
select tests.assert(public.store_quick_bag(array[tests.id('v_chips'), tests.id('v_live')]) is null,
  'one other piece makes it a normal bag (the founder''s rule)');
select tests.assert(public.store_quick_bag('{}'::uuid[]) is null and public.store_quick_bag(array[gen_random_uuid()]) is null,
  'an empty bag or an unknown option is not');

set local role service_role;
select tests.assert(
  (select c -> 'quick_delivery' ->> 'est_delivery_to' = (current_date + 7)::text and c -> 'express' = 'null'::jsonb
   from public.checkout_context(array[tests.id('v_chips')]) c),
  'checkout: the 7-day window, and no Express for a bag that already arrives sooner');
select tests.assert(
  public.checkout_context(array[tests.id('v_chips'), tests.id('v_live')]) -> 'quick_delivery' = 'null'::jsonb,
  'checkout: a mixed bag has no 7-day window');
select tests.remember('quick_order', (select order_id from public.create_order(jsonb_build_object(
  'email', 'quick@example.test', 'shipping_address', '{"line1": "1 Main St"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_chips'), 'quantity', 2, 'unit_price_cents', 3)),
  'subtotal_cents', 6, 'total_cents', 6))));
select tests.remember('mixed_order', (select order_id from public.create_order(jsonb_build_object(
  'email', 'mixed@example.test', 'shipping_address', '{"line1": "1 Main St"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_chips'), 'quantity', 1, 'unit_price_cents', 3),
                             jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 5003, 'total_cents', 5003))));
reset role;

select tests.assert(
  (select cycle_id is null and est_delivery_from = current_date + 7 and est_delivery_to = current_date + 7
   from public.orders where id = tests.id('quick_order')),
  'a 7-day order keeps the window it was shown, outside any cycle');
select tests.assert(
  (select count(*) = 1 from public.pickups pk join public.order_items oi on oi.id = pk.order_item_id
   where oi.order_id = tests.id('quick_order')),
  'its piece is on the pickup list at once');
select tests.assert(
  (select est_delivery_to = current_date + 18 from public.orders where id = tests.id('mixed_order')),
  'a mixed order gets the normal window');

-- 7-day delivery off: no tag, no page, no window (non-negotiable 4: the days come from Settings only).
update public.pricing_settings set quick_delivery_days_min = null, quick_delivery_days_max = null where id = 1;
select tests.assert(public._quick_days((select id from public.products where slug = 'qd-chips')) is null
  and public.store_quick_bag(array[tests.id('v_chips')]) is null
  and jsonb_array_length(public.store_quick_browse() -> 'products') = 0,
  'with the days empty nothing is a 7-day piece');
select tests.assert_fails('update public.pricing_settings set quick_delivery_days_min = 8, quick_delivery_days_max = 7',
  '23514', 'the latest day cannot come before the earliest');

rollback;

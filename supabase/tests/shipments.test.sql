-- D-154: one bag, one or two shipments (migration 20261023120000). 7-day pieces worth the 7-day line ($49.99, after
-- the promo) ship on their own in the 7-day days; with other pieces the order is split in two; a bag of only them ships
-- free. Shipping is $18.62 a billed kg for the whole bag, one parcel, shared by weight. The address decides last.
begin;
select tests.setup();

update public.pricing_settings
   set quick_delivery_days_min = 7, quick_delivery_days_max = 7, quick_delivery_min_cents = 4999,
       shipping_cents_per_kg = 1862, pilot_delivery_days_min = 12, pilot_delivery_days_max = 16,
       free_shipping_min_cents = 9999, food_billed_pct = 100, food_cleared = true, quick_delivery_paused = false
 where id = 1;
insert into public.categories (product_type, slug, name) values ('food', 'sh-snacks', 'Snacks')
  on conflict (slug) do nothing;

-- A $10 snack (100 g) bought on Blinkit, and a $50 kurta (1 kg) from a shop in India.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, source_url, source_site, wears, attributes)
values ('sh-snack', 'Snack', 'food', null, (select id from public.categories where slug = 'sh-snacks'),
        tests.id('vendor'), 1000, 'live', now(), 'https://blinkit.com/prn/x/prid/1', 'blinkit.com', null, '{}'),
       ('sh-kurta', 'Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 5000, 'live',
        now(), 'https://example.in/kurta', 'example.in', 'women',
        '{"fibre_content": "100% cotton", "care": "Hand wash"}');
update public.products set price_auto = false where slug in ('sh-snack', 'sh-kurta');
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'SH-SNACK', '100 g', 50, 100 from public.products where slug = 'sh-snack'
union all
select id, 'SH-KURTA', 'M', 10, 1000 from public.products where slug = 'sh-kurta';
update public.products set price_cents = 1000 where slug = 'sh-snack';
update public.products set price_cents = 5000 where slug = 'sh-kurta';
select tests.remember('v_snack', (select id from public.product_variants where sku = 'SH-SNACK'));
select tests.remember('v_kurta', (select id from public.product_variants where sku = 'SH-KURTA'));

create temp table bag (name text primary key, items jsonb) on commit drop;
insert into bag values
  ('five snacks', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5))),
  ('four snacks', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 4))),
  ('five snacks and a kurta', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5),
                                                jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1))),
  ('four snacks and a kurta', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 4),
                                                jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1))),
  ('a kurta', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1)));
create function pg_temp.ship(p_name text, p_discount integer default 0, p_state text default null,
                             p_line1 text default null) returns jsonb language sql as $$
  select public._bag_shipments(items, p_discount, p_state, p_line1) from bag where name = p_name
$$;

-- Cases 1 – 4: the bag's groups.
select tests.assert(pg_temp.ship('five snacks') @> '{"quick_only": true, "split": false, "quick_cents": 5000}'::jsonb
  and pg_temp.ship('five snacks') -> 'gap_cents' = 'null'::jsonb,
  'case 1: only 7-day pieces, $50: one 7-day shipment');
select tests.assert(pg_temp.ship('four snacks') @> '{"quick_only": false, "split": false, "gap_cents": 999}'::jsonb,
  'case 2: only 7-day pieces, $40: the normal window, $9.99 more brings them in 7');
select tests.assert(pg_temp.ship('five snacks and a kurta') @> '{"quick_only": false, "split": true}'::jsonb,
  'case 3: $50 of 7-day pieces and a kurta: two shipments');
select tests.assert(pg_temp.ship('four snacks and a kurta') @> '{"split": false, "gap_cents": 999}'::jsonb,
  'case 4: $40 of 7-day pieces and a kurta: one shipment, the gap shown');
select tests.assert(pg_temp.ship('a kurta') @> '{"split": false, "quick_only": false, "quick_cents": 0}'::jsonb
  and pg_temp.ship('a kurta') -> 'gap_cents' = 'null'::jsonb,
  'no 7-day pieces: no 7-day line at all');

-- Cases 6 – 7: the promo counts against the line, spread over the pieces by value.
select tests.assert(pg_temp.ship('five snacks', 100) @> '{"quick_only": false, "quick_cents": 4900, "gap_cents": 99}'::jsonb,
  'case 6: a $1 promo takes $50 of 7-day pieces under the line');
select tests.assert(pg_temp.ship('five snacks and a kurta', 200) @> '{"split": false, "quick_cents": 4900}'::jsonb,
  'case 7: a $2 promo on $100 takes $1 from the 7-day pieces: one shipment');

-- Case 13: the address decides last.
select tests.assert(pg_temp.ship('five snacks and a kurta', 0, 'AK') @> '{"split": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'HI') @> '{"quick_only": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'NY', 'PO Box 12') @> '{"quick_only": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'AE', 'Unit 2050') @> '{"outside": true}'::jsonb,
  'case 13: Alaska, Hawaii, a PO box or the military: everything in one shipment, with the reason');
select tests.assert(pg_temp.ship('five snacks', 0, 'NY', '12 Post Road') @> '{"quick_only": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'DC', '1 Apollo St') @> '{"quick_only": true}'::jsonb,
  'a street that only looks like a box (Post Road, Apollo St) and DC keep the 7 days');

-- Shipping: one parcel, the whole bag; split by weight.
select tests.assert(pg_temp.ship('five snacks') @> '{"billed_grams": 1000, "shipping_cents": 1862}'::jsonb,
  '500 g is billed 1 kg: $18.62');
select tests.assert(pg_temp.ship('five snacks and a kurta')
  @> '{"billed_grams": 1500, "shipping_cents": 2793, "quick_shipping_cents": 931}'::jsonb,
  'a split bag pays one parcel (1.5 kg, $27.93, not $18.62 + $18.62); the 7-day shipment carries its third');
select tests.assert(
  public.store_bag_charges((select items from bag where name = 'five snacks')) @> '{"quick_free": true}'::jsonb
  and public.store_bag_charges((select items from bag where name = 'four snacks')) @> '{"quick_free": false}'::jsonb
  and public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) @> '{"quick_free": false}'::jsonb,
  'case 4 of the money: only 7-day pieces from the line ship free; a kurta brings Shipping back (case 35)');
select tests.assert(
  public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) -> 'quick_ids'
    = jsonb_build_array(tests.id('v_snack'))
  and public.store_bag_charges((select items from bag where name = 'a kurta')) -> 'quick_ids' = '[]'::jsonb,
  'step 3: the bag answer names which of the options it was asked are 7-day pieces (never a shop)');
select tests.assert(
  public.store_bag_charges((select items from bag where name = 'five snacks')) -> 'dates'
    = jsonb_build_object('quick_from', current_date + 7, 'quick_to', current_date + 7,
                         'standard_from', current_date + 12, 'standard_to', current_date + 16),
  'and the dates each shipment would arrive by from today');
select tests.assert(
  not (public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) -> 'shipments'
       ?| array['billed_grams', 'quick_shipping_cents', 'quick_variant_ids']),
  'no weight leaves the database with the bag''s answer (non-negotiable 1)');

-- Orders: the same rule, the shipments stored.
set local role service_role;
select tests.remember('o_quick', (select order_id from public.create_order(jsonb_build_object(
  'email', 'quick@example.test', 'shipping_address', '{"line1": "1 Main St", "state": "NY"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5, 'unit_price_cents', 1000)),
  'subtotal_cents', 5000, 'shipping_cents', 0, 'total_cents', 5000))));
select tests.remember('o_split', (select order_id from public.create_order(jsonb_build_object(
  'email', 'split@example.test', 'shipping_address', '{"line1": "1 Main St", "state": "NY"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5, 'unit_price_cents', 1000),
                             jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 10000, 'shipping_cents', 2793, 'total_cents', 12793))));
select tests.remember('o_alaska', (select order_id from public.create_order(jsonb_build_object(
  'email', 'ak@example.test', 'shipping_address', '{"line1": "1 Main St", "state": "AK"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5, 'unit_price_cents', 1000),
                             jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 10000, 'shipping_cents', 2793, 'total_cents', 12793))));
reset role;

select tests.assert(
  (select count(*) = 1 and bool_and(kind = 'quick' and est_delivery_to = current_date + 7 and shipping_cents = 0)
   from public.order_shipments where order_id = tests.id('o_quick'))
  and (select est_delivery_to = current_date + 7 from public.orders where id = tests.id('o_quick')),
  'an order of $50 of 7-day pieces: one 7-day shipment, the order''s window 7 days');
select tests.assert(
  (select array_agg(kind || ':' || (est_delivery_to - current_date) || ':' || shipping_cents order by seq)
   from public.order_shipments where order_id = tests.id('o_split')) = array['quick:7:931', 'standard:16:1862'],
  'a split order: shipment 1 the 7-day pieces in 7 days, shipment 2 the rest in 12 – 16; the shares add up to $27.93');
select tests.assert(
  (select bool_and(sh.kind = case when oi.variant_id = tests.id('v_snack') then 'quick' else 'standard' end)
   from public.order_items oi join public.order_shipments sh on sh.id = oi.shipment_id
   where oi.order_id = tests.id('o_split')),
  'each piece is on its own shipment');
select tests.assert(
  (select count(*) = 1 and bool_and(kind = 'standard' and est_delivery_to = current_date + 16)
   from public.order_shipments where order_id = tests.id('o_alaska')),
  'an Alaska order is one shipment in 12 – 16 days');
select tests.assert(
  (select count(*) = 1 from public.order_shipments where order_id = tests.id('order_a'))
  and not exists (select 1 from public.order_items where order_id = tests.id('order_a') and shipment_id is null),
  'every order has its shipment, every piece its place');

-- Customers read shipments only through their order (step 3); the table itself is the admin's.
select tests.assert(
  not has_table_privilege('anon', 'public.order_shipments', 'select')
  and not has_function_privilege('anon', 'public._bag_shipments(jsonb, integer, text, text)', 'execute'),
  'no customer reads the shipments table or the rule directly');

-- Case 32: paused, nothing is a 7-day piece and nothing splits; placed orders keep their dates.
update public.pricing_settings set quick_delivery_paused = true where id = 1;
select tests.assert(pg_temp.ship('five snacks and a kurta') @> '{"split": false, "quick_cents": 0}'::jsonb
  and pg_temp.ship('five snacks') -> 'gap_cents' = 'null'::jsonb
  and public._quick_days((select id from public.products where slug = 'sh-snack')) is null,
  'case 32: paused, no tags, no split, no 7-day line');
select tests.assert((select est_delivery_to = current_date + 7 from public.order_shipments
                     where order_id = tests.id('o_quick')), 'a placed 7-day order keeps its date');

rollback;

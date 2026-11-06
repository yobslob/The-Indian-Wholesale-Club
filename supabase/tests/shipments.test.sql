-- D-154, D-187: one bag, one or two shipments. Food ships on its own in the food days; with other pieces the order is
-- split in two; outside the 48 states and DC everything is one shipment, in the standard days. Shipping is $18.62 a
-- billed kg for the whole bag, one parcel, shared by weight. The address decides last.
begin;
select tests.setup();

update public.pricing_settings
   set food_delivery_days_min = 7, food_delivery_days_max = 7, shipping_cents_per_kg = 1862, delivery_days_min = 12,
       delivery_days_max = 16, free_shipping_min_cents = 4999, food_billed_pct = 100
 where id = 1;
insert into public.categories (product_type, slug, name) values ('food', 'sh-snacks', 'Snacks')
  on conflict (slug) do nothing;

-- A $10 snack (100 g), and a $50 kurta (1 kg).
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status,
                             published_at, source_url, source_site, wears, attributes)
values ('sh-snack', 'Snack', 'food', null, (select id from public.categories where slug = 'sh-snacks'),
        1000, 'live', now(), 'https://blinkit.com/prn/x/prid/1', 'blinkit.com', null, '{}'),
       ('sh-kurta', 'Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), 5000, 'live',
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
  ('five snacks and a kurta', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5),
                                                jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1))),
  ('a kurta', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1)));
create function pg_temp.ship(p_name text, p_discount integer default 0, p_state text default null,
                             p_line1 text default null) returns jsonb language sql as $$
  select public._bag_shipments(items, p_discount, p_state, p_line1) from bag where name = p_name
$$;

-- The bag's groups.
select tests.assert(pg_temp.ship('five snacks') @> '{"food_only": true, "split": false, "food_cents": 5000, "outside": false}'::jsonb,
  'only food: one food shipment');
select tests.assert(pg_temp.ship('five snacks and a kurta') @> '{"food_only": false, "split": true}'::jsonb,
  'food and a kurta: two shipments');
select tests.assert(pg_temp.ship('a kurta') @> '{"split": false, "food_only": false, "food_cents": 0, "outside": false}'::jsonb,
  'no food: one standard shipment');

-- The promo is spread over the pieces by value; it no longer decides a shipment.
select tests.assert(pg_temp.ship('five snacks and a kurta', 200) @> '{"split": true, "food_cents": 4900}'::jsonb,
  'a $2 promo on $100 takes $1 from the food; still two shipments');

-- The address decides last.
select tests.assert(pg_temp.ship('five snacks and a kurta', 0, 'AK') @> '{"split": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'HI') @> '{"food_only": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'NY', 'PO Box 12') @> '{"food_only": false, "outside": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'AE', 'Unit 2050') @> '{"outside": true}'::jsonb,
  'Alaska, Hawaii, a PO box or the military: everything in one shipment, with the reason');
select tests.assert(pg_temp.ship('five snacks', 0, 'NY', '12 Post Road') @> '{"food_only": true}'::jsonb
  and pg_temp.ship('five snacks', 0, 'DC', '1 Apollo St') @> '{"food_only": true}'::jsonb,
  'a street that only looks like a box (Post Road, Apollo St) and DC keep the 7 days');

-- Shipping: one parcel, the whole bag; split by weight.
select tests.assert(pg_temp.ship('a kurta') @> '{"billed_grams": 1000, "shipping_cents": 1862}'::jsonb,
  'one 1 kg piece is billed 1 kg: $18.62');
select tests.assert(pg_temp.ship('five snacks') @> '{"billed_grams": 1400, "shipping_cents": 2607}'::jsonb,
  'D-190: five 100 g snacks: the first billed 1 kg, the other four their own 400 g: $26.07');
select tests.assert(public._bag_shipments(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1),
                                                            jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 1)))
  @> '{"billed_grams": 1500, "shipping_cents": 2793}'::jsonb,
  'D-190: never under the whole bag by the half kg: a 1 kg piece and a 100 g piece are 1.5 kg, not 1.1');
select tests.assert(pg_temp.ship('five snacks and a kurta')
  @> '{"billed_grams": 1500, "shipping_cents": 2793, "food_shipping_cents": 931}'::jsonb,
  'a split bag pays one parcel (1.5 kg, $27.93, not $18.62 + $18.62); the food shipment carries its third');
select tests.assert(
  public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) -> 'food_ids'
    = jsonb_build_array(tests.id('v_snack'))
  and public.store_bag_charges((select items from bag where name = 'a kurta')) -> 'food_ids' = '[]'::jsonb,
  'the bag answer names which of the options it was asked are food');
select tests.assert(
  public.store_bag_charges((select items from bag where name = 'five snacks')) -> 'dates'
    @> jsonb_build_object('food_from', public._add_business_days(current_date, 7),
                          'food_to', public._add_business_days(current_date, 7),
                          'standard_from', public._add_business_days(current_date, 12),
                          'standard_to', public._add_business_days(current_date, 16)),
  'and the dates each shipment would arrive by from today, in business days');
select tests.assert(
  not (public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) -> 'shipments'
       ?| array['billed_grams', 'food_shipping_cents', 'food_variant_ids']),
  'no weight leaves the database with the bag''s answer (non-negotiable 1)');

-- TODO(D-187): drop when app <next version> is the minimum
select tests.assert(
  (select c -> 'quick_ids' = jsonb_build_array(tests.id('v_snack'))
          and c -> 'shipments' @> '{"quick_cents": 5000, "quick_only": false, "split": true}'::jsonb
          and c -> 'shipments' -> 'min_cents' = 'null'::jsonb and c -> 'shipments' -> 'gap_cents' = 'null'::jsonb
          and c -> 'dates' ->> 'quick_to' = public._add_business_days(current_date, 7)::text
   from public.store_bag_charges((select items from bag where name = 'five snacks and a kurta')) c),
  'the old app''s bag still parses: its keys carry the food answer, with no 7-day line');

-- Orders: the same rule, the shipments stored.
set local role service_role;
select tests.remember('o_food', (select order_id from public.create_order(jsonb_build_object(
  'email', 'food@example.test', 'shipping_address', '{"line1": "1 Main St", "state": "NY"}'::jsonb,
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
  (select count(*) = 1 and bool_and(kind = 'food' and est_delivery_to = public._add_business_days(current_date, 7) and shipping_cents = 0)
   from public.order_shipments where order_id = tests.id('o_food'))
  and (select est_delivery_to = public._add_business_days(current_date, 7) from public.orders where id = tests.id('o_food')),
  'a food order: one food shipment, the order''s window 7 delivery days');
select tests.assert(
  (select array_agg(kind || ':' || est_delivery_to || ':' || shipping_cents order by seq)
   from public.order_shipments where order_id = tests.id('o_split'))
  = array['food:' || public._add_business_days(current_date, 7) || ':931',
          'standard:' || public._add_business_days(current_date, 16) || ':1862'],
  'a split order: shipment 1 the food in 7 delivery days, shipment 2 the rest in 12 – 16; the shares add up to $27.93');
select tests.assert(
  (select bool_and(sh.kind = case when oi.variant_id = tests.id('v_snack') then 'food' else 'standard' end)
   from public.order_items oi join public.order_shipments sh on sh.id = oi.shipment_id
   where oi.order_id = tests.id('o_split')),
  'each piece is on its own shipment');
select tests.assert(
  (select count(*) = 1 and bool_and(kind = 'standard' and est_delivery_to = public._add_business_days(current_date, 16))
   from public.order_shipments where order_id = tests.id('o_alaska')),
  'an Alaska order is one shipment in 12 – 16 delivery days');
select tests.assert(
  (select count(*) = 1 from public.order_shipments where order_id = tests.id('order_a'))
  and not exists (select 1 from public.order_items where order_id = tests.id('order_a') and shipment_id is null),
  'every order has its shipment, every piece its place');

-- Customers read shipments only through their order; the table itself is the admin's.
select tests.assert(
  not has_table_privilege('anon', 'public.order_shipments', 'select')
  and not has_function_privilege('anon', 'public._bag_shipments(jsonb, integer, text, text)', 'execute'),
  'no customer reads the shipments table or the rule directly');

rollback;

-- D-154 step 2 (migration 20261024090000): each shipment ships, arrives, moves its dates and is cancelled on its own.
-- The plan's "done when": an order ships as two parcels with two tracking emails, and a refunded 7-day piece leaves
-- the second shipment untouched.
begin;
select tests.setup();

update public.pricing_settings
   set quick_delivery_days_min = 7, quick_delivery_days_max = 7, quick_delivery_min_cents = 4999,
       shipping_cents_per_kg = 1862, pilot_delivery_days_min = 12, pilot_delivery_days_max = 16,
       free_shipping_min_cents = 9999, food_billed_pct = 100, food_cleared = true, quick_delivery_paused = false,
       cancel_fee_pct = 0
 where id = 1;
insert into public.categories (product_type, slug, name) values ('food', 'sa-snacks', 'Snacks')
  on conflict (slug) do nothing;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, source_url, source_site, wears, attributes)
values ('sa-snack', 'Snack', 'food', null, (select id from public.categories where slug = 'sa-snacks'),
        tests.id('vendor'), 1000, 'live', now(), 'https://blinkit.com/prn/x/prid/1', 'blinkit.com', null, '{}'),
       ('sa-kurta', 'Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 5000, 'live',
        now(), 'https://example.in/kurta', 'example.in', 'women',
        '{"fibre_content": "100% cotton", "care": "Hand wash"}');
update public.products set price_auto = false where slug in ('sa-snack', 'sa-kurta');
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'SA-SNACK', '100 g', 50, 100 from public.products where slug = 'sa-snack'
union all
select id, 'SA-KURTA', 'M', 10, 1000 from public.products where slug = 'sa-kurta';
update public.products set price_cents = 1000 where slug = 'sa-snack';
update public.products set price_cents = 5000 where slug = 'sa-kurta';
select tests.remember('v_snack', (select id from public.product_variants where sku = 'SA-SNACK'));
select tests.remember('v_kurta', (select id from public.product_variants where sku = 'SA-KURTA'));

-- Four split orders: $50 of 7-day snacks and a kurta, to New York ($27.93 Shipping, one parcel).
create function pg_temp.split_order(p_email text) returns uuid language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', p_email, 'shipping_address', '{"line1": "1 Main St", "state": "NY"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', 5, 'unit_price_cents', 1000),
                               jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 10000, 'shipping_cents', 2793, 'total_cents', 12793))
$$;
set local role service_role;
select tests.remember('o_two', pg_temp.split_order('two@example.test'));
select tests.remember('o_refund', pg_temp.split_order('refund@example.test'));
select tests.remember('o_delay', pg_temp.split_order('delay@example.test'));
select tests.remember('o_cancel', pg_temp.split_order('cancel@example.test'));
reset role;

create function pg_temp.sh(p_order text, p_seq integer) returns uuid language sql as $$
  select id from public.order_shipments where order_id = tests.id(p_order) and seq = p_seq
$$;
create function pg_temp.pk(p_order text, p_variant text) returns uuid language sql as $$
  select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
  where oi.order_id = tests.id(p_order) and oi.variant_id = tests.id(p_variant)
$$;
create function pg_temp.mails(p_order text) returns text[] language sql as $$
  select array_agg(m order by m) from (
    select (x.payload ->> 'kind') || coalesce(':' || (x.payload ->> 'shipment'), '') as m
    from public.email_outbox x
    where x.kind = 'order_update' and x.payload ->> 'kind' in ('shipped', 'delivered', 'delivery_window_changed', 'shipment_cancelled')
      and x.payload ->> 'orderNumber' = (select order_number from public.orders where id = tests.id(p_order))) y
$$;

set local role authenticated;
select tests.act_as(tests.id('admin'));

-- An order of two shipments is shipped and moved one shipment at a time.
select tests.assert_fails(format('select public.ship_order(%L, %L, %L)', tests.id('o_two'), 'DHL', '1234567890'),
  'order_has_two_shipments', 'the bulk ship refuses an order of two shipments');
select tests.assert_fails(format('select public.change_delivery_window(%L, %L, %L)', tests.id('o_two'), current_date + 20, current_date + 24),
  'order_has_two_shipments', 'and so does the order-wide date change');
select tests.assert_fails(format('select public.ship_shipment(%L, %L, %L)', pg_temp.sh('o_two', 1), 'DHL', '1234567890'),
  'express_not_picked', 'the 7-day shipment leaves the hub once its pieces are there');

-- Two parcels, two tracking emails.
select public.mark_pickup(pg_temp.pk('o_two', 'v_snack'), 'picked');
select public.ship_shipment(pg_temp.sh('o_two', 1), ' DHL ', ' 1234567890 ');
select tests.assert(
  (select status = 'shipped' and carrier = 'DHL' and tracking_number = '1234567890' and shipped_at is not null
   from public.order_shipments where id = pg_temp.sh('o_two', 1))
  and (select status = 'confirmed' from public.orders where id = tests.id('o_two')),
  'shipment 1 is on its way; the order is still being prepared (shipment 2 is not)');
select tests.assert_fails(format('select public.ship_shipment(%L, %L, %L)', pg_temp.sh('o_two', 1), 'DHL', '1234567890'),
  'shipment_not_open', 'a shipment ships once');
select public.mark_pickup(pg_temp.pk('o_two', 'v_kurta'), 'picked');
select public.ship_shipment(pg_temp.sh('o_two', 2), 'UPS', '1Z999AA10123456784');
select tests.assert(
  (select status = 'shipped' and tracking_number = '1Z999AA10123456784' from public.orders where id = tests.id('o_two')),
  'with both on their way the order is Shipped, with the latest tracking number');
select public.deliver_shipment(pg_temp.sh('o_two', 1));
select tests.assert((select status = 'shipped' from public.orders where id = tests.id('o_two')),
  'one parcel delivered: the order is still Shipped');
select public.deliver_order(tests.id('o_two'));
select tests.assert((select status = 'delivered' from public.orders where id = tests.id('o_two'))
  and (select bool_and(status = 'delivered') from public.order_shipments where order_id = tests.id('o_two')),
  'both delivered: the order is Delivered');

-- A refunded 7-day piece leaves the second shipment untouched (cases 17, 19, 22).
select public.mark_pickup(pg_temp.pk('o_refund', 'v_snack'), 'unavailable');
select public.refund_order_item(
  (select id from public.order_items where order_id = tests.id('o_refund') and variant_id = tests.id('v_snack')),
  public.item_refund_cents((select id from public.order_items where order_id = tests.id('o_refund') and variant_id = tests.id('v_snack'))),
  're_snack');
select tests.assert(
  (select array_agg(status order by seq) from public.order_shipments where order_id = tests.id('o_refund')) = array['cancelled', 'open']
  and (select status = 'active' from public.order_items where order_id = tests.id('o_refund') and variant_id = tests.id('v_kurta'))
  and (select status = 'confirmed' and refunded_cents = 5000 from public.orders where id = tests.id('o_refund')),
  'the 7-day shipment has nothing left to send and is cancelled; the kurta''s shipment goes on');
select tests.assert(public.shipment_cancel_cents(pg_temp.sh('o_refund', 2), 'customer_request') is null,
  'its last shipment is cancelled as the order, not on its own');
select public.mark_pickup(pg_temp.pk('o_refund', 'v_kurta'), 'picked');
select public.ship_order(tests.id('o_refund'), 'USPS', '9400100000000000000000');
select tests.assert((select status = 'shipped' from public.orders where id = tests.id('o_refund')),
  'one shipment left: the bulk ship works again, and a pilot order ships once its pieces are at the hub');

-- Cases 23 – 24: the whole order can be cancelled until the hub buys the 7-day pieces; after that only shipment 2.
reset role;
select tests.assert((public._order_actions(tests.id('o_delay')) ->> 'can_cancel')::boolean,
  'case 23: before the 7-day pieces are bought, the customer may cancel everything');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.mark_pickup(pg_temp.pk('o_delay', 'v_snack'), 'picked');
reset role;
select tests.assert(not (public._order_actions(tests.id('o_delay')) ->> 'can_cancel')::boolean,
  'case 24: once they are bought the order cannot be cancelled as a whole');
set local role service_role;
select tests.assert_fails(format('select public.customer_cancel(%L, 12793, null)', tests.id('o_delay')), 'quick_bought',
  'and the database refuses it');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.shipment_cancel_cents(pg_temp.sh('o_delay', 1), 'customer_request') is null,
  'nor can the bought 7-day shipment be cancelled');
select tests.assert(public.shipment_cancel_cents(pg_temp.sh('o_delay', 2), 'customer_request') = 6862,
  'shipment 2 can, for the kurta ($50.00) and its Shipping share ($18.62)');

-- Cases 28 – 29: a delay for one shipment, the customer's choice for that shipment.
select public.ship_shipment(pg_temp.sh('o_delay', 1), 'DHL', '2234567890');
select public.change_shipment_window(pg_temp.sh('o_delay', 2), current_date + 20, current_date + 24, 'slipped');
select tests.assert(
  (select est_delivery_from = current_date + 20 and est_delivery_to = current_date + 24
   from public.order_shipments where id = pg_temp.sh('o_delay', 2))
  and (select est_delivery_from = current_date + 7 and est_delivery_to = current_date + 24
       from public.orders where id = tests.id('o_delay')),
  'shipment 2 has its new dates; the order spans both');
reset role;
select tests.assert(
  (public._order_actions(tests.id('o_delay')) - 'returns')
  @> '{"delay_open": true, "delay_refund_cents": 6862, "delay_shipment": 2}'::jsonb,
  'the customer may cancel shipment 2 for its share back');
set local role service_role;
select tests.assert_fails(format('select public.cancel_after_delay(%L, 12793, %L)', tests.id('o_delay'), 're_d'),
  'refund_amount_mismatch', 'never the whole order');
select public.cancel_after_delay(tests.id('o_delay'), 6862, 're_d');
reset role;
select tests.assert(
  (select array_agg(status order by seq) from public.order_shipments where order_id = tests.id('o_delay')) = array['shipped', 'cancelled']
  and (select status = 'shipped' and refunded_cents = 6862 and payment_status = 'partially_refunded'
       from public.orders where id = tests.id('o_delay'))
  and not exists (select 1 from public.pickups where id = pg_temp.pk('o_delay', 'v_kurta')),
  'shipment 2 is cancelled and its kurta back on the shop''s stock; with shipment 1 on its way the order is Shipped');
select tests.assert(pg_temp.mails('o_delay') = array['delivery_window_changed:2', 'shipment_cancelled:2', 'shipped:1'],
  'each email names its shipment');
select tests.assert(pg_temp.mails('o_two') = array['delivered:1', 'delivered:2', 'shipped:1', 'shipped:2'],
  'two parcels: two shipped emails, two delivered emails');

-- Customer care cancels shipment 2 because the customer asked.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('select public.admin_cancel_shipment(%L, %L, 1, null)', pg_temp.sh('o_cancel', 2), 'customer_request'),
  'refund_amount_mismatch', 'the amount is checked again');
select public.admin_cancel_shipment(pg_temp.sh('o_cancel', 2), 'customer_request', 6862, 're_c');
select tests.assert(
  (select status = 'confirmed' and refunded_cents = 6862 from public.orders where id = tests.id('o_cancel'))
  and (select status = 'open' from public.order_shipments where id = pg_temp.sh('o_cancel', 1)),
  'shipment 2 is cancelled; the 7-day shipment goes on');

-- The India desk: To order's 7-day lane and Today's watch.
reset role;
update public.orders set created_at = now() - interval '3 hours' where id = tests.id('o_cancel');
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select buy_by = ordered_on + interval '2 hours' and ship_by = ordered_on + interval '1 day'
   from public.admin_to_order() where pickup_id = pg_temp.pk('o_cancel', 'v_snack')),
  'a 7-day piece to order carries its buy-by and ship-by times');
select tests.assert(public.admin_quick_watch() = '{"open": 1, "not_bought": 1, "not_shipped": 0}'::jsonb,
  'Today: one 7-day shipment open, not bought within 2 hours');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_quick_watch()', 'admin_only', 'customers never see it');
select tests.assert_fails(format('select public.ship_shipment(%L, %L, %L)', pg_temp.sh('o_cancel', 1), 'DHL', '1234567890'),
  'admin_only', 'nor ship anything');

-- The customer's order lists its shipments, nothing operational.
reset role;
select tests.assert(
  (select jsonb_array_length(d -> 'shipments') = 2
          and d -> 'shipments' -> 0 @> '{"seq": 1, "kind": "quick", "status": "shipped", "carrier": "DHL"}'::jsonb
          and jsonb_array_length(d -> 'shipments' -> 0 -> 'item_ids') = 1
   from (select public.guest_order_lookup((select order_number from public.orders where id = tests.id('o_delay')),
                                          'delay@example.test') as d) x),
  'the order shows each shipment with its pieces and tracking');
select tests.assert(
  not exists (select 1 from tests.json_keys(public.guest_order_lookup(
                (select order_number from public.orders where id = tests.id('o_delay')), 'delay@example.test')) k
              where k = any (tests.forbidden_keys())),
  'and no shop, weight or internal key (D-003)');

rollback;

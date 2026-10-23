-- D-154 step 5: Insights watches the 7-day promise (migration 20261027090000). Three paid orders and one unpaid:
--   o1 split: 7-day snacks worth $52.00 (just past the line), delivered on time; a kurta still on its way.
--   o2 7-day only: $70.00 after a $20 promo, one snack refunded as unavailable, past its promised day, with a delay
--      notice sent three days before it.
--   o3 a kurta delivered five days late, with no notice.
--   o4 unpaid: not counted.
begin;
select tests.setup();

update public.pricing_settings
   set quick_delivery_min_cents = 4999, courier_first_kg_paise = 200000, courier_next_kg_paise = 200000,
       food_billed_pct = 100
 where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values ('qi-snack', 'Qi snack', 'food', null, tests.id('cat_food'),
        tests.id('vendor'), 2600, 'draft', null),
       ('qi-kurta', 'Qi kurta', 'clothing', null, tests.id('cat_clothing'),
        tests.id('vendor'), 4000, 'draft', null);
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
values ((select id from public.products where slug = 'qi-snack'), 'QI-SNACK', '200 g', 20, 600),
       ((select id from public.products where slug = 'qi-kurta'), 'QI-KURTA', 'M', 20, 800);

-- tests.setup() places paid orders of its own (no shipments): counted before this test's
select tests.act_as(tests.id('admin'));
create temp table base on commit drop as select (public.admin_quick_insights() ->> 'orders')::int as n;

create function pg_temp.order_(p_ref text, p_paid boolean, p_subtotal integer, p_discount integer) returns uuid
language sql as $$
  insert into public.orders (email, status, payment_status, subtotal_cents, discount_cents, total_cents, shipping_address)
  values (p_ref || '@example.test', 'confirmed', case when p_paid then 'paid' else 'pending' end::public.payment_status,
          p_subtotal, p_discount, p_subtotal - p_discount, '{"line1": "1 Main St"}'::jsonb)
  returning id
$$;
create function pg_temp.ship(p_order uuid, p_seq integer, p_kind text, p_to date, p_status text) returns uuid
language sql as $$
  insert into public.order_shipments (order_id, seq, kind, est_delivery_from, est_delivery_to, status)
  values (p_order, p_seq, p_kind, p_to - 4, p_to, p_status) returning id
$$;
create function pg_temp.item(p_order uuid, p_ship uuid, p_slug text, p_qty integer, p_unit integer, p_status text)
returns void language sql as $$
  insert into public.order_items (order_id, shipment_id, variant_id, product_id, product_name, variant_label, region_name,
                                  quantity, unit_price_cents, total_price_cents, status)
  select p_order, p_ship, v.id, p.id, p.name, v.label, 'India', p_qty, p_unit, p_qty * p_unit,
         p_status::public.order_item_status
  from public.products p join public.product_variants v on v.product_id = p.id where p.slug = p_slug
$$;

select tests.remember('o1', pg_temp.order_('o1', true, 9200, 0));
select tests.remember('s1q', pg_temp.ship(tests.id('o1'), 1, 'quick', current_date + 1, 'delivered'));
select tests.remember('s1s', pg_temp.ship(tests.id('o1'), 2, 'standard', current_date + 10, 'open'));
select pg_temp.item(tests.id('o1'), tests.id('s1q'), 'qi-snack', 2, 2600, 'active');
select pg_temp.item(tests.id('o1'), tests.id('s1s'), 'qi-kurta', 1, 4000, 'active');
insert into public.order_events (order_id, shipment_id, kind) values (tests.id('o1'), tests.id('s1q'), 'delivered');

select tests.remember('o2', pg_temp.order_('o2', true, 9000, 2000));
select tests.remember('s2q', pg_temp.ship(tests.id('o2'), 1, 'quick', current_date - 1, 'shipped'));
select pg_temp.item(tests.id('o2'), tests.id('s2q'), 'qi-snack', 2, 3000, 'active');
select pg_temp.item(tests.id('o2'), tests.id('s2q'), 'qi-snack', 1, 3000, 'unavailable');
insert into public.order_events (order_id, shipment_id, kind, created_at)
values (tests.id('o2'), tests.id('s2q'), 'delivery_window_changed', now() - interval '3 days');

select tests.remember('o3', pg_temp.order_('o3', true, 4000, 0));
select tests.remember('s3s', pg_temp.ship(tests.id('o3'), 1, 'standard', current_date - 5, 'delivered'));
select pg_temp.item(tests.id('o3'), tests.id('s3s'), 'qi-kurta', 1, 4000, 'active');
insert into public.order_events (order_id, shipment_id, kind) values (tests.id('o3'), tests.id('s3s'), 'delivered');

select tests.remember('o4', pg_temp.order_('o4', false, 5200, 0));
select pg_temp.item(tests.id('o4'), pg_temp.ship(tests.id('o4'), 1, 'quick', current_date + 1, 'open'), 'qi-snack', 2, 2600,
                    'active');

-- The promise stays when a delay moves the date
update public.order_shipments set est_delivery_to = current_date + 3, est_delivery_from = current_date
 where id = tests.id('s2q');
select tests.assert((select promised_to = current_date - 1 from public.order_shipments where id = tests.id('s2q')),
  'a new date leaves the promise as it was');
update public.order_shipments set est_delivery_to = current_date - 1, est_delivery_from = current_date - 5
 where id = tests.id('s2q');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_quick_insights()', '42501', 'customers cannot read Insights');
select tests.act_as(tests.id('admin'));
create temp table qi on commit drop as select public.admin_quick_insights(now()) as r;

select tests.assert((select (r ->> 'orders')::int = (select n from base) + 3 and (r ->> 'with_quick')::int = 2 and (r ->> 'split')::int = 1
                     from qi), 'paid orders, those with a 7-day shipment, those split (the unpaid one left out)');
select tests.assert((select r -> 'past_line' = '{"within_5": 1, "within_15": 0, "more": 1}'::jsonb from qi),
  'the 7-day pieces after the promo against the line: $52.00 just past, $70.00 well past');
select tests.assert(
  (select r -> 'shipments' -> 0 = '{"kind": "quick", "due": 2, "on_time": 1, "late": 1, "late_noticed": 1, "overdue": 1}'::jsonb
   from qi),
  '7-day shipments: one on time, one past its day with its notice sent first');
select tests.assert(
  (select r -> 'shipments' -> 1 = '{"kind": "standard", "due": 1, "on_time": 0, "late": 1, "late_noticed": 0, "overdue": 0}'::jsonb
   from qi),
  'normal shipments: the one not yet due is not counted; the late one had no notice');
select tests.assert((select r -> 'unavailable' = '{"pieces": 1, "cents": 3000}'::jsonb from qi),
  '7-day pieces refunded as unavailable');
-- two parcels: 1.2 kg billed 1.5 kg (₹3,000) and 0.8 kg billed 1 kg (₹2,000); together 2 kg (₹4,000)
select tests.assert((select (r ->> 'split_extra_paise')::int = 100000 from qi), 'the split''s extra courier cost: ₹1,000');
select tests.assert((select (r ->> 'with_quick')::int from (select public.admin_quick_insights(now() + interval '1 day') as r) x) = 0,
  'the period counts orders placed since then');

rollback;

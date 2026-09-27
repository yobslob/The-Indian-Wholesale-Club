-- INV-3: no overselling.  INV-4: every stock change writes one ledger row.
begin;
select tests.setup();

-- v_live: listed 2, reserved 1 (order A). One unit left.
select public.create_order(jsonb_build_object(
  'email', 'cust.b@example.test', 'user_id', tests.id('cust_b'), 'shipping_address', '{"line1": "x"}'::jsonb,
  'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1, 'unit_price_cents', 5000)),
  'subtotal_cents', 5000, 'total_cents', 5000, 'payment_intent_id', 'pi_test_last_unit'));
select tests.assert((select qty_reserved from public.product_variants where id = tests.id('v_live')) = 2,
  'the last unit was reserved');
select tests.assert((select available from public.variant_availability where variant_id = tests.id('v_live')) = 0,
  'public availability mirror shows 0');

select tests.assert_fails(format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000, 'payment_intent_id', 'pi_test_oversell'))$q$, tests.id('v_live')),
  'insufficient_stock', 'INV-3: ordering a sold-out variant fails');
select tests.assert((select count(*) from public.orders where payment_intent_id = 'pi_test_oversell') = 0,
  'INV-3: a failed order leaves no order row behind');
select tests.assert((select qty_reserved from public.product_variants where id = tests.id('v_live')) = 2,
  'INV-3: a failed order leaves reservations unchanged');

select tests.assert_fails(format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 1)),
    'subtotal_cents', 1, 'total_cents', 1, 'payment_intent_id', 'pi_test_price'))$q$, tests.id('v_live2')),
  'price_mismatch', 'a client-supplied price that differs from the catalog is rejected');

select tests.assert_fails(format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000, 'payment_intent_id', 'pi_test_ph'))$q$, tests.id('v_placeholder')),
  'variant_unavailable', 'placeholder products cannot be ordered outside dev preview');

select tests.assert_fails(
  format('update public.product_variants set qty_reserved = 0 where id = %L', tests.id('v_live')),
  'qty_reserved can only change', 'INV-3: reservations cannot be edited by hand');
select tests.assert_fails(
  format('update public.product_variants set qty_listed = 1 where id = %L', tests.id('v_live')),
  '23514', 'INV-3: listed stock can never drop below what is reserved');

-- Admin correction of listed stock is allowed and logged as 'adjusted' with the actor.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  tests.rows_affected(format('update public.product_variants set qty_listed = qty_listed + 3 where id = %L',
                             tests.id('v_live'))) = 1,
  'admin can correct listed stock');
reset role;
select tests.assert(
  (select reason::text || ':' || delta_listed || ':' || (actor = tests.id('admin'))::text
   from public.stock_movements where variant_id = tests.id('v_live') order by id desc limit 1) = 'adjusted:3:true',
  'INV-4: the correction is logged as adjusted +3 by the admin');

-- With stock available again, a tampered subtotal is still rejected and leaves no trace.
select tests.assert_fails(format($q$select public.create_order(jsonb_build_object(
    'email', 'x@example.test', 'shipping_address', '{"line1": "x"}'::jsonb,
    'items', jsonb_build_array(jsonb_build_object('variant_id', %L::uuid, 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 9999, 'total_cents', 9999, 'payment_intent_id', 'pi_test_subtotal'))$q$, tests.id('v_live')),
  'subtotal_mismatch', 'a subtotal that does not match the items is rejected');
select tests.assert((select qty_reserved from public.product_variants where id = tests.id('v_live')) = 2,
  'the rejected order reserved nothing');

-- INV-4 across everything that happened: the ledger sums to the current stock.
select tests.assert(
  not exists (
    select 1 from public.product_variants v
    left join (select variant_id, sum(delta_listed) as l, sum(delta_reserved) as r
               from public.stock_movements group by variant_id) m on m.variant_id = v.id
    where coalesce(m.l, 0) <> v.qty_listed or coalesce(m.r, 0) <> v.qty_reserved),
  'INV-4: for every variant, ledger totals equal qty_listed and qty_reserved');

rollback;

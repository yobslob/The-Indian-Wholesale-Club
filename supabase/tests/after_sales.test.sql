-- After the sale (migration 26; D-071, D-072): cancels until the order leaves India, customer-care cancels after,
-- returns by reason and time, and US clearance stock.
begin;
select tests.setup();
update public.pricing_settings set cancel_fee_pct = 5, export_cancel_deduction_pct = 25, return_claim_days = 7,
  return_tier1_days = 7, return_tier1_pct = 15, return_tier2_days = 14, return_tier2_pct = 30, return_tier3_days = 30,
  return_tier3_pct = 50, clearance_discount_pct = 30, domestic_days_min = 3, domestic_days_max = 7 where id = 1;
insert into public.product_variants (product_id, sku, label, qty_listed)
values (tests.id('p_live'), 'TEST-LIVE-X', 'Medium', 10) returning tests.remember('v_x', id);

create function pg_temp.buy(p_intent text, p_variant uuid, p_price integer) returns uuid language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
    'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', p_variant, 'quantity', 1, 'unit_price_cents', p_price)),
    'subtotal_cents', p_price, 'total_cents', p_price, 'payment_intent_id', p_intent));
$$;

-- 1. Before the cutoff: the customer's cancel refunds everything (no fee, nothing collected yet).
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select tests.assert((public._order_actions(tests.id('order_a')) ->> 'cancel_refund_cents')::int = 5400,
  'D-072: before collection, everything back');
select tests.assert_fails(format('select public.customer_cancel(%L, 5000, %L)', tests.id('order_a'), 're_x'),
  'refund_amount_mismatch', 'the amount must be the rule''s');
select public.customer_cancel(tests.id('order_a'), 5400, 're_a');
select tests.assert((select status = 'cancelled' and refunded_cents = 5400 from public.orders where id = tests.id('order_a')),
  'cancelled and refunded');
select tests.assert((select qty_reserved from public.product_variants where id = tests.id('v_live')) = 0,
  'its piece goes back to the shop''s stock');

-- 2. Collecting, the piece already picked: still in India, so the customer may cancel, minus the cancel fee; the
--    collected piece becomes a US clearance draft at the clearance discount.
select public.cutoff_cycle(tests.id('cycle'));
select public.mark_pickup((select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                           where oi.order_id = tests.id('order_b')), 'picked');
select tests.assert((public._order_actions(tests.id('order_b')) ->> 'cancel_refund_cents')::int = 6000 - 300,
  'a 5% cancel fee once pieces are collected');
select public.customer_cancel(tests.id('order_b'), 5700, 're_b');
select tests.remember('clearance_b', (select id from public.products where is_us_stock and slug like 'test-live-us-%'));
select tests.assert(
  (select status = 'draft' and price_cents = 4199 and not price_auto from public.products where id = tests.id('clearance_b')),
  'D-072: the collected piece is a clearance draft, 30% off what was paid, down to $41.99');
select tests.assert(
  (select qty_listed = 1 and label = 'Large' from public.product_variants where product_id = tests.id('clearance_b')),
  'one piece, the same variant');
reset role;

-- 3. A clearance piece in the US ships at once: an order of only US pieces skips the cycle.
update public.products set status = 'live' where id = tests.id('clearance_b');
select tests.assert(
  (select (pg -> 'ships_from_us' ->> 'est_delivery_from')::date = current_date + 3
          and (pg -> 'ships_from_us' ->> 'est_delivery_to')::date = current_date + 7
   from (select public.store_product_page(r.slug, p.slug) pg
         from public.products p join public.regions r on r.id = p.region_id where p.id = tests.id('clearance_b')) x),
  'its product page says when it arrives from the US');
select tests.assert(
  (select public.store_product_page(r.slug, p.slug) -> 'ships_from_us' = 'null'::jsonb
   from public.products p join public.regions r on r.id = p.region_id where p.id = tests.id('p_live')),
  'a piece in India has no US date');
select tests.remember('order_us', pg_temp.buy('pi_us', (select id from public.product_variants
                                                         where product_id = tests.id('clearance_b')), 4199));
select tests.assert(
  (select status = 'arrived' and cycle_id is null and est_delivery_from = current_date + 3 and est_delivery_to = current_date + 7
   from public.orders where id = tests.id('order_us')),
  'ready to ship from the US at once, delivered in the US delivery days');
select tests.assert(not exists (select 1 from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                                where oi.order_id = tests.id('order_us')), 'no pickup in India for it');

-- 4. After it left India: no customer cancel; customer care cancels with the 25% shipping deduction.
select tests.remember('order_t', pg_temp.buy('pi_t', tests.id('v_x'), 5000));
-- In transit means its piece was collected: picked, on its way.
insert into public.pickups (order_item_id, cycle_id, vendor_id, variant_id, quantity, status, picked_at)
select oi.id, null, tests.id('vendor'), oi.variant_id, oi.quantity, 'picked', now()
from public.order_items oi where oi.order_id = tests.id('order_t');
update public.orders set status = 'in_transit' where id = tests.id('order_t');
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select tests.assert(not (public._order_actions(tests.id('order_t')) ->> 'can_cancel')::boolean,
  'D-072: once it left India the cancel button is gone');
select tests.assert_fails(format('select public.customer_cancel(%L, 5000, null)', tests.id('order_t')), 'order_left_india',
  'and the customer cannot cancel');
reset role;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(public.admin_cancel_after_export_cents(tests.id('order_t')) = 3750, 'customer care: all but 25%');
select public.admin_cancel_after_export(tests.id('order_t'), 3750, 're_t');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.admin_cancel_after_export(%L, 3750, null)', tests.id('order_t')), 'admin_only',
  'customers cannot use it');
reset role;
select tests.assert((select status = 'cancelled' and refunded_cents = 3750 from public.orders where id = tests.id('order_t')),
  'cancelled with the deduction kept');
select tests.assert(exists (select 1 from public.order_events where order_id = tests.id('order_t') and kind = 'note'
                            and internal_note like '%US clearance draft%'), 'its piece goes to US clearance');

-- 5. Returns (D-071), three days after delivery.
select tests.remember('order_r', pg_temp.buy('pi_r', tests.id('v_x'), 5000));
update public.orders set status = 'delivered' where id = tests.id('order_r');
insert into public.order_events (order_id, kind, visible_to_customer, created_at)
values (tests.id('order_r'), 'delivered', true, now() - interval '3 days');
select tests.remember('item_r', (select id from public.order_items where order_id = tests.id('order_r')));
select tests.assert((select refund_cents = 5000 and kept_pct = 0 from public._return_quote(tests.id('item_r'), 'damaged')),
  'damaged within 7 days: everything back');
select tests.assert((select refund_cents = 4250 and kept_pct = 15 from public._return_quote(tests.id('item_r'), 'changed_mind')),
  'a change of mind within 7 days: 15% kept for fetching');
update public.order_events set created_at = now() - interval '10 days' where order_id = tests.id('order_r') and kind = 'delivered';
select tests.assert((select refund_cents = 3500 from public._return_quote(tests.id('item_r'), 'changed_mind')),
  'within 14 days: 30% kept');
select tests.assert((select count(*) = 0 from public._return_quote(tests.id('item_r'), 'damaged')),
  'a damage claim after 7 days is too late');
update public.order_events set created_at = now() - interval '40 days' where order_id = tests.id('order_r') and kind = 'delivered';
select tests.assert((select count(*) = 0 from public._return_quote(tests.id('item_r'), 'changed_mind')),
  'after 30 days: no returns');
update public.order_events set created_at = now() - interval '3 days' where order_id = tests.id('order_r') and kind = 'delivered';

select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select tests.assert(
  (select (r ->> 'change_of_mind_refund_cents')::int = 4250 and not (r ->> 'requested')::boolean
   from jsonb_array_elements(public._order_actions(tests.id('order_r')) -> 'returns') r),
  'the order page offers the return with its refund');
select tests.remember('ret', public.request_return(tests.id('order_r'), tests.id('item_r'), 'changed_mind'));
select tests.assert_fails(format('select public.request_return(%L, %L, %L)', tests.id('order_r'), tests.id('item_r'), 'damaged'),
  'not_returnable', 'a piece is returned once');
reset role;
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert_fails(format('select public.admin_return_refunded(%L, 4250, null)', tests.id('ret')), 'return_not_received',
  'no refund before the piece is back');
select public.admin_return_received(tests.id('ret'));
select tests.assert_fails(format('select public.admin_return_refunded(%L, 5000, null)', tests.id('ret')), 'refund_amount_mismatch',
  'the refund is the amount fixed when it was asked for');
select public.admin_return_refunded(tests.id('ret'), 4250, 're_r');
reset role;
select tests.assert(
  (select refunded_cents = 4250 and payment_status = 'partially_refunded' from public.orders where id = tests.id('order_r'))
  and (select status = 'refunded' from public.order_items where id = tests.id('item_r')),
  'refunded, the line marked');
select tests.assert(exists (select 1 from public.products where is_us_stock and status = 'draft'
                            and slug like 'test-live-us-%' and id <> tests.id('clearance_b')),
  'the returned piece is a clearance draft');

-- Food is final sale for a change of mind; a damage claim still works.
update public.pricing_settings set spices_cleared = true where id = 1;
update public.products set product_type = 'spice', category_id = tests.id('cat_spice') where id = tests.id('p_live');
select tests.remember('order_s', pg_temp.buy('pi_s', tests.id('v_x'), 5000));
update public.orders set status = 'delivered' where id = tests.id('order_s');
insert into public.order_events (order_id, kind, visible_to_customer) values (tests.id('order_s'), 'delivered', true);
select tests.assert(
  (select count(*) = 0 from public._return_quote((select id from public.order_items where order_id = tests.id('order_s')), 'changed_mind')),
  'food is final sale');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.customer_cancel(%L, 1, null)', tests.id('order_s')), '42501',
  'customers cancel through the website''s server, never directly');
reset role;

-- The Shipping & returns page reads the same numbers (migration 27), and only the terms a customer is offered.
set local role anon;
select tests.assert(
  (select (p ->> 'return_claim_days')::int = 7
          and p -> 'return_tiers' = '[{"days": 7, "kept_pct": 15.00}, {"days": 14, "kept_pct": 30.00}, {"days": 30, "kept_pct": 50.00}]'::jsonb
          and (p ->> 'us_delivery_days_min')::int = 3
   from public.store_policy() p),
  'visitors read the return windows and delivery days the rules use');
select tests.assert(
  (select not (p ? 'export_cancel_deduction_pct') and not (p ? 'margin_pct') and not (p ? 'freight_cents_per_kg')
          and not (p ? 'clearance_discount_pct')
   from public.store_policy() p),
  'D-003: no cost, margin or customer-care deduction in it');
reset role;
rollback;

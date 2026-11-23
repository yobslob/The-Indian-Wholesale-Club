-- D-205, Send home (migration 20261126090000): the gift beside the goods, one per order, owner-only reads, the hold,
-- the desk's sent / couldn't send, and cancels before and after sending.
begin;
select tests.setup();

update public.pricing_settings set send_home_inr_per_usd = 92, send_home_hold_hours = null, cancel_fee_pct = 0 where id = 1;
with v as (insert into public.product_variants (product_id, sku, label, qty_listed, price_cents)
           values (tests.id('p_live'), 'TEST-GIFT-1', 'Gift size', 20, 5000) returning id)
select tests.remember('v_gift', (select id from v));

create function pg_temp.gift_order(p_user uuid, p_email text, p_pi text, p_gift jsonb) returns uuid
language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', p_email, 'user_id', p_user,
    'shipping_address', jsonb_build_object('fullName', 'Gift Sender', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_gift'), 'quantity', 1, 'unit_price_cents', 5000)),
    'subtotal_cents', 5000, 'total_cents', 5000 + coalesce((p_gift ->> 'usd_cents')::integer, 0),
    'payment_intent_id', p_pi, 'home_gift', p_gift));
$$;

-- ---------------------------------------------------------------- an order with a gift (cust_a already has order_a)
select tests.remember('o1', pg_temp.gift_order(tests.id('cust_a'), 'cust.a@example.test', 'pi_gift_1', jsonb_build_object(
  'usd_cents', 400, 'inr_per_usd', 92, 'inr_paise', 36800, 'relation', 'maa', 'call_name', 'Maa',
  'upi', '9847012345', 'region_id', tests.id('region'), 'note', 'Namaste Maa', 'sender_first_name', 'Asha', 'save', true)));
select tests.assert(
  (select subtotal_cents = 5000 and home_gift_cents = 400 and total_cents = 5400 from public.orders where id = tests.id('o1')),
  'the order keeps the goods as they were and carries the gift beside them in the total');
select tests.assert(
  (select status = 'to_send' and inr_paise = 36800 and inr_per_usd = 92 and call_name = 'Maa' and upi = '9847012345'
          and region_name is not null and loved_one_id is not null
   from public.home_gifts where order_id = tests.id('o1')),
  'one gift to send, its rupees promised at the rate, its loved one saved');
select tests.assert(
  (select count(*) = 1 from public.loved_ones where profile_id = tests.id('cust_a') and upi = '9847012345'),
  'Remember Maa saved her once');
select tests.assert(
  (select order_id is not null from public.create_order(jsonb_build_object(
     'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
     'shipping_address', jsonb_build_object('state', 'TX', 'line1', '1 Main St'),
     'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_gift'), 'quantity', 1, 'unit_price_cents', 5000)),
     'subtotal_cents', 5000, 'total_cents', 5000, 'payment_intent_id', 'pi_gift_none'))),
  'an order without a gift is made exactly as before');
select tests.assert_fails(
  $$select pg_temp.gift_order(tests.id('cust_a'), 'cust.a@example.test', 'pi_gift_bad', jsonb_build_object(
      'usd_cents', 400, 'inr_per_usd', 92, 'inr_paise', 36800, 'relation', 'maa', 'call_name', 'Maa', 'upi', 'not a upi'))$$,
  'home_gifts_upi_check', 'a UPI that is neither an ID nor an Indian mobile is refused');
select tests.assert(
  (select count(*) = 0 from public.orders where payment_intent_id = 'pi_gift_bad'),
  'and the whole order with it (one transaction)');
select tests.assert_fails(
  $$insert into public.home_gifts (order_id, call_name, relation, upi, usd_cents, inr_per_usd, inr_paise, status)
    values (tests.id('o1'), 'Papa', 'papa', '9847012346', 100, 92, 9200, 'to_send')$$,
  '23505', 'one gift per order');
select tests.assert_fails(
  $$update public.orders set home_gift_cents = 500 where id = tests.id('o1')$$,
  'orders_total_matches', 'the total always adds up with the gift in it');

-- ---------------------------------------------------------------- the hold: a customer's first paid order waits
update public.pricing_settings set send_home_hold_hours = 24 where id = 1;
select tests.create_user('new_buyer', 'new.buyer@example.test');
select tests.remember('o_new', pg_temp.gift_order(tests.id('new_buyer'), 'new.buyer@example.test', 'pi_gift_new',
  jsonb_build_object('usd_cents', 500, 'inr_per_usd', 92, 'inr_paise', 46000, 'relation', 'papa', 'call_name', 'Papa',
                     'upi', 'papa.k@okaxis')));
select tests.assert(
  (select status = 'on_hold' and hold_until > now() + interval '23 hours' from public.home_gifts where order_id = tests.id('o_new')),
  'a first paid order''s gift waits the hold');
select tests.assert(
  (select status = 'to_send' from public.home_gifts where order_id = tests.id('o1')),
  'a returning customer''s does not');
select tests.assert(
  (select count(*) = 0 from public.loved_ones where upi = 'papa.k@okaxis'),
  'without Remember, nothing is saved');

-- ---------------------------------------------------------------- what customers read
select set_config('tests.o1_number', (select order_number from public.orders where id = tests.id('o1')), true);
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select count(*) = 1 and bool_and(upi_masked = '98470·····' and customer_status = 'sending' and inr_paise = 36800)
   from public.store_home_gifts),
  'the owner sees their gift, masked, as Sending');
select tests.assert(
  not exists (select 1 from tests.json_keys((select to_jsonb(g) from public.store_home_gifts g limit 1)) k
              where k in ('upi', 'sent_by', 'utr', 'inr_per_usd', 'hold_until', 'profile_id')),
  'and never the whole UPI, who sent it, the rate or the hold');
select tests.assert((select count(*) = 1 from public.loved_ones), 'the owner sees their loved ones');
select tests.assert(
  (select (s ->> 'inr_per_usd')::numeric = 92 and (s ->> 'max_cents')::int = 10000
          and jsonb_array_length(s -> 'loved_ones') = 1 and s -> 'loved_ones' -> 0 ->> 'call_name' = 'Maa'
          and s -> 'loved_ones' -> 0 ->> 'upi_masked' = '98470·····' and not (s -> 'loved_ones' -> 0) ? 'upi'
   from public.store_send_home() s),
  'the bag reads the rate, the cap and Maa');
select tests.assert(
  (select (d -> 'order' ->> 'home_gift_cents')::int = 400 and d -> 'home_gift' ->> 'customer_status' = 'sending'
          and (d -> 'home_gift' -> 'so_far' ->> 'inr_paise')::int = 36800
   from (select public.store_my_order(current_setting('tests.o1_number')) d) x),
  'the order page shows its gift and what has gone home so far');
select tests.assert(
  (select (p -> 'total' ->> 'inr_paise')::int = 0 and jsonb_array_length(p -> 'history') = 1
   from public.store_my_people() p),
  'Your people at home: nothing counted as sent until it is');
select tests.assert((select count(*) = 0 from public.home_gifts), 'the gifts table shows a customer nothing (admin only)');
select tests.assert_fails($$select public.admin_send_home('to_send')$$, 'admin_only', 'nor the desk''s queue');
update public.profiles set send_home_in_bag = false where id = tests.id('cust_a');
select tests.assert((select not (s ->> 'in_bag')::boolean from public.store_send_home() s), 'the account''s switch');

select tests.act_as(tests.id('cust_b'));
select tests.assert(
  (select count(*) = 0 from public.store_home_gifts) and (select count(*) = 0 from public.loved_ones),
  'another customer sees none of it');
select tests.assert_fails(
  $$insert into public.loved_ones (profile_id, relation, call_name, upi) values (tests.id('cust_a'), 'maa', 'Maa', '9847012399')$$,
  '42501', 'nor adds a loved one to someone else');
reset role;
set local role anon;
select tests.assert((select s ->> 'in_bag' = 'true' and s -> 'loved_ones' = '[]'::jsonb from public.store_send_home() s),
  'a guest reads only the settings');
reset role;

-- ---------------------------------------------------------------- the desk
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select (q -> 'counts' ->> 'to_send')::int = 1 and (q -> 'counts' ->> 'on_hold')::int = 1
          and (q -> 'counts' ->> 'to_send_inr_paise')::int = 36800 and q -> 'gifts' -> 0 ->> 'upi' = '9847012345'
   from public.admin_send_home('to_send') q),
  'To send lists the returning customer''s gift with the whole UPI; the first order''s is On hold');
select tests.assert_fails(
  format('select public.admin_home_gift_sent(%L, %L)', (select id from public.home_gifts where order_id = tests.id('o_new')), 'UTR123456'),
  'gift_on_hold', 'a held gift cannot be marked sent');
select tests.assert_fails(
  format('select public.admin_home_gift_sent(%L, %L)', (select id from public.home_gifts where order_id = tests.id('o1')), 'x'),
  'utr_invalid', 'Mark sent needs the UPI reference');
select public.admin_home_gift_sent((select id from public.home_gifts where order_id = tests.id('o1')), ' 412345678901 ');
reset role;
select tests.assert(
  (select status = 'sent' and utr = '412345678901' and sent_by = tests.id('admin') from public.home_gifts where order_id = tests.id('o1'))
  and exists (select 1 from public.email_outbox where kind = 'home_gift_sent' and recipient = 'cust.a@example.test'),
  'Mark sent records the reference and who, and emails the customer');

-- a sent gift stays sent: the customer's cancel gives back the goods only (rule 12)
select tests.assert(
  public._customer_cancel_cents(tests.id('o1')) = 5000,
  'a cancel after sending refunds the goods, not the gift');
select set_config('request.jwt.claims', '{"role": "service_role"}', true);  -- the website's server
select public.customer_cancel(tests.id('o1'), 5000, 're_test_cancel_1');
select tests.assert(
  (select status = 'sent' from public.home_gifts where order_id = tests.id('o1'))
  and (select payment_status = 'partially_refunded' and refunded_cents = 5000 from public.orders where id = tests.id('o1')),
  'the order is cancelled, the gift stays sent');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select (p -> 'total' ->> 'inr_paise')::int = 36800 and (p -> 'total' ->> 'times')::int = 1
          and (p -> 'loved_ones' -> 0 ->> 'sent_inr_paise')::int = 36800 and p -> 'history' -> 0 ->> 'utr_last4' = '8901'
   from public.store_my_people() p),
  'once sent, it counts: ₹368 sent home, the reference''s last four');
reset role;

-- an order cancelled before its gift is sent refunds and cancels the gift with it
update public.home_gifts set status = 'to_send', hold_until = null where order_id = tests.id('o_new');
select tests.assert(public._customer_cancel_cents(tests.id('o_new')) = 5500, 'an unsent gift is refunded with the order');
select set_config('request.jwt.claims', '{"role": "service_role"}', true);  -- the website's server
select public.customer_cancel(tests.id('o_new'), 5500, 're_test_cancel_2');
select tests.assert(
  (select status = 'cancelled' from public.home_gifts where order_id = tests.id('o_new')),
  'and the gift is cancelled');

-- couldn't send: the gift alone comes back, counted once even when Stripe's webhook got there first
update public.pricing_settings set send_home_hold_hours = null where id = 1;
select tests.remember('o3', pg_temp.gift_order(tests.id('cust_b'), 'cust.b@example.test', 'pi_gift_3', jsonb_build_object(
  'usd_cents', 900, 'inr_per_usd', 92, 'inr_paise', 82800, 'relation', 'didi', 'call_name', 'Didi', 'upi', 'didi@ybl')));
select public.record_stripe_refund('pi_gift_3', 900, 're_gift_3');  -- the webhook, first
set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.admin_home_gift_failed((select id from public.home_gifts where order_id = tests.id('o3')), 'wrong UPI', 're_gift_3', 900);
reset role;
select tests.assert(
  (select status = 'refunded' and refund_id = 're_gift_3' from public.home_gifts where order_id = tests.id('o3'))
  and (select refunded_cents = 900 and payment_status = 'partially_refunded' from public.orders where id = tests.id('o3'))
  and exists (select 1 from public.email_outbox where kind = 'home_gift_failed' and recipient = 'cust.b@example.test'),
  'Couldn''t send refunds the gift alone, once, and tells the customer');
select tests.assert(
  public._cancel_refund_cents(tests.id('o3'), 'customer_request') = 5000,
  'a later cancel refunds what is left: the goods');

-- an open dispute holds every gift of that customer
select tests.remember('o4', pg_temp.gift_order(tests.id('cust_b'), 'cust.b@example.test', 'pi_gift_4', jsonb_build_object(
  'usd_cents', 400, 'inr_per_usd', 92, 'inr_paise', 36800, 'relation', 'didi', 'call_name', 'Didi', 'upi', 'didi@ybl')));
insert into public.payment_disputes (dispute_id, order_id, amount_cents, status) values ('dp_gift', tests.id('order_b'), 6000, 'needs_response');
select tests.assert(
  (select public._home_gift_held(g) from public.home_gifts g where order_id = tests.id('o4')),
  'an open dispute on the customer holds their gift');

-- the checkout's read: the month so far and a saved loved one only for its owner
select tests.assert(
  (select (c ->> 'month_used_cents')::int = 400 and c -> 'loved_one' = 'null'::jsonb
   from public.checkout_send_home(tests.id('cust_b'), 'cust.b@example.test',
                                  (select id from public.loved_ones where profile_id = tests.id('cust_a') limit 1)) c),
  'checkout reads this month''s gifts and never another customer''s loved one');
rollback;

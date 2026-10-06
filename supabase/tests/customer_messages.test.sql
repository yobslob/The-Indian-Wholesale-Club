-- Customer messages (migration 17; flows.md §7, §7b, §8; D-003, D-008, D-042): an email per visible update, the
-- delay choice (keep or cancel for a full refund), and what the order page offers.
begin;
select tests.setup();

select tests.assert(not exists (select 1 from public.email_outbox where kind = 'order_update'
                                and payload ->> 'orderNumber' in (select order_number from public.orders
                                                                  where id in (tests.id('order_a'), tests.id('order_b')))),
  'the confirmation has its own email: no update email for it');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select public.change_delivery_window(tests.id('order_a'), current_date + 30, current_date + 34, 'export slipped');
reset role;
insert into public.order_events (order_id, kind, visible_to_customer, internal_note)
values (tests.id('order_a'), 'note', false, 'internal only');

select tests.assert(
  (select count(*) from public.email_outbox e join public.orders o on o.order_number = e.payload ->> 'orderNumber'
   where o.id = tests.id('order_a') and e.kind = 'order_update') = 1,
  'B-20: a visible update queues one email; an internal note queues none');
select tests.assert(
  (select recipient = 'cust.a@example.test' and payload ->> 'kind' = 'delivery_window_changed'
          and (select array_agg(k order by k) from jsonb_object_keys(payload) k) = array['eventId', 'kind', 'orderNumber']
   from public.email_outbox e where e.kind = 'order_update'
     and payload ->> 'orderNumber' = (select order_number from public.orders where id = tests.id('order_a'))),
  'D-003: the email row holds the order number, the event and its kind, nothing operational');

-- What the customer may do now.
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert(
  (select public.store_my_order(o.order_number) -> 'actions' from public.store_orders o where o.id = tests.id('order_a'))
  = '{"can_cancel": true, "cancel_refund_cents": 5400, "delay_open": true, "delay_refund_cents": 5400}'::jsonb,
  'D-073 / D-008: a cancel refunds everything, the tax included (it was the state''s money)');
select tests.assert_fails(format('select public.keep_after_delay(%L)', tests.id('order_a')), 'admin_only',
  'customers decide through the website''s server, which checks the order email first');
reset role;

-- Service role (the website's server).
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select public.keep_after_delay(tests.id('order_a'));
select tests.assert(not public._delay_open(tests.id('order_a')), 'kept: the delay is settled');
select tests.assert(exists (select 1 from public.order_events where order_id = tests.id('order_a') and kind = 'delay_kept'
                            and not visible_to_customer), 'the choice is recorded (D-008)');
select tests.assert_fails(format('select public.keep_after_delay(%L)', tests.id('order_a')), 'no_open_delay',
  'nothing to keep without a delay');

-- A second delay, and this time they cancel. (In real use the two choices are minutes apart; inside this one
-- transaction now() is the same, so the first choice is moved a minute back.)
update public.order_events set created_at = created_at - interval '1 minute'
 where order_id = tests.id('order_a') and kind in ('delay_kept', 'delivery_window_changed');
select public.change_delivery_window(tests.id('order_a'), current_date + 40, current_date + 44, 'slipped again');
select tests.assert_fails(format('select public.cancel_after_delay(%L, 5000, %L)', tests.id('order_a'), 're_1'),
  'refund_amount_mismatch', 'a delay is our fault: the refund must be everything');
select public.cancel_after_delay(tests.id('order_a'), 5400, 're_1');
select tests.assert(
  (select status = 'cancelled' and refunded_cents = 5400 and payment_status = 'refunded' from public.orders
   where id = tests.id('order_a')), 'cancelled after a delay, refunded in full');
select tests.assert((select qty_reserved from public.product_variants where id = tests.id('v_live')) = 0,
  'its reserved piece is back on sale');
select tests.assert(
  exists (select 1 from public.email_outbox where kind = 'order_update' and payload ->> 'kind' = 'order_cancelled'
          and recipient = 'cust.a@example.test'),
  'and the cancellation is emailed');

-- After cutoff, with the piece already collected: no self-service cancel; a delay cancel keeps the piece for the admin.
select public.cutoff_cycle(tests.id('cycle'));
select public.mark_pickup((select p.id from public.pickups p join public.order_items oi on oi.id = p.order_item_id
                           where oi.order_id = tests.id('order_b')), 'picked');
select tests.assert(
  (select (public._order_actions(tests.id('order_b')) ->> 'can_cancel')::boolean) = false,
  'D-042: no change-of-mind cancel after the cutoff');
select public.change_delivery_window(tests.id('order_b'), current_date + 40, current_date + 44, 'slipped');
select public.cancel_after_delay(tests.id('order_b'), 6000, 're_2');
select tests.assert(
  exists (select 1 from public.order_events where order_id = tests.id('order_b') and kind = 'note'
          and internal_note like '%Q-31%'),
  'a collected piece of a cancelled order is flagged for the admin (Q-31)');
select tests.assert(
  (select p.status = 'picked' from public.pickups p join public.order_items oi on oi.id = p.order_item_id
   where oi.order_id = tests.id('order_b')),
  'and stays on record as collected (the shop is still owed for it)');
reset role;
select set_config('request.jwt.claims', '', true);

-- The timer exists, and does nothing without the Vault settings.
select public._kick_email_outbox();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform tests.assert(exists (select 1 from cron.job where jobname = 'iwc-email-outbox'), 'the outbox is sent every minute');
  end if;
end $$;

rollback;

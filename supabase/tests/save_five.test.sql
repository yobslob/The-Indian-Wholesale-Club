-- D-208 (migration 20261128090000): every order saves 5% of its goods, paid by IWC: kept as Coins (spent by the next
-- order, a guest's waiting for an account) or sent home by the desk; the customer pays the same; a cancel takes it back.
begin;
select tests.setup();

update public.pricing_settings
   set send_home_open = 1, send_home_inr_per_usd = 92, send_home_rate_at = now(), send_home_hold_hours = null
 where id = 1;
with v as (insert into public.product_variants (product_id, sku, label, qty_listed, price_cents)
           values (tests.id('p_live'), 'TEST-SAVE-1', 'Save size', 40, 8500) returning id)
select tests.remember('v_save', (select id from v));

select tests.assert((select save_pct = 5 and send_home_keep_pct = 0 from public.pricing_settings where id = 1),
  'the saving is 5% and IWC keeps nothing of a gift (D-208)');
select tests.assert((select count(*) = 0 from public.promo_codes where is_active), 'every coupon is off');

create function pg_temp.save_order(p_user uuid, p_email text, p_pi text, p_saving jsonb, p_coins integer default 0)
returns uuid
language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', p_email, 'user_id', p_user,
    'shipping_address', jsonb_build_object('fullName', 'Asha Rao', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_save'), 'quantity', 1, 'unit_price_cents', 8500)),
    'subtotal_cents', 8500, 'discount_cents', p_coins, 'coins_used', p_coins, 'total_cents', 8500 - p_coins,
    'payment_intent_id', p_pi, 'saving', p_saving));
$$;

-- ---------------------------------------------------------------- kept: Coins, spent by the next order
select tests.create_user('keeper', 'keeper@example.test');
update public.profiles set coins = 50 where id = tests.id('keeper');
select tests.remember('o_keep', pg_temp.save_order(tests.id('keeper'), 'keeper@example.test', 'pi_save_keep',
  jsonb_build_object('cents', 425, 'pct', 5, 'outcome', 'coins')));
select tests.assert(
  (select total_cents = 8500 and home_gift_cents = 0 from public.orders where id = tests.id('o_keep')),
  'the customer pays exactly the order: the saving is not in the total');
select tests.assert(
  (select outcome = 'coins' and save_cents = 425 and credited_at is not null and profile_id = tests.id('keeper')
   from public.order_savings where order_id = tests.id('o_keep')),
  'one saving row, kept, credited at once');
select tests.assert(
  (select saved_coins = 425 and coins between 50 + 1 + 425 and 50 + 8 + 425 from public.profiles where id = tests.id('keeper')),
  '425 Coins join the wallet (with D-191''s refill)');
create temp table before_spend on commit drop as select coins, saved_coins from public.profiles where id = tests.id('keeper');
select pg_temp.save_order(tests.id('keeper'), 'keeper@example.test', 'pi_save_spend',
  jsonb_build_object('cents', 425, 'pct', 5, 'outcome', 'coins'), (select coins from before_spend));
select tests.assert(
  (select p.saved_coins = 425 and p.coins between b.coins - 425 + 1 + 425 and b.coins - 425 + 8 + 425
   from public.profiles p, before_spend b where p.id = tests.id('keeper')),
  'the next order spends the kept 425 (the D-191 part stays) and keeps its own new 425');

-- ---------------------------------------------------------------- a cancel takes the Coins back
update public.orders set status = 'cancelled' where id = tests.id('o_keep');
select tests.assert(
  (select taken_back_at is not null from public.order_savings where order_id = tests.id('o_keep')),
  'a cancelled order''s saving is taken back');
select tests.assert(
  (select saved_coins = 0 from public.profiles where id = tests.id('keeper')),
  'its Coins leave the wallet (never below what is left of the kept part)');

-- ---------------------------------------------------------------- a guest keeps it until they make an account
select tests.remember('o_guest', pg_temp.save_order(null, 'later@example.test', 'pi_save_guest',
  jsonb_build_object('cents', 300, 'pct', 5, 'outcome', 'coins')));
select tests.assert(
  (select credited_at is null and profile_id is null from public.order_savings where order_id = tests.id('o_guest')),
  'a guest''s Coins wait');
select tests.create_user('later', 'Later@example.test');
select tests.assert(
  (select s.credited_at is not null and s.profile_id = tests.id('later') and p.saved_coins = 300
   from public.order_savings s join public.profiles p on p.id = s.profile_id where s.order_id = tests.id('o_guest')),
  'an account with that email picks them up');

-- ---------------------------------------------------------------- sent home by IWC
select tests.create_user('sender', 'sender@example.test');
select tests.remember('o_gift', pg_temp.save_order(tests.id('sender'), 'sender@example.test', 'pi_save_gift',
  jsonb_build_object('cents', 425, 'pct', 5, 'outcome', 'gift', 'gift', jsonb_build_object(
    'inr_per_usd', 92, 'inr_paise', 39100, 'relation', 'maa', 'call_name', 'Maa', 'upi', '9847012345',
    'note', 'Namaste Maa', 'sender_first_name', 'Asha', 'save', true))));
select tests.assert(
  (select o.total_cents = 8500 and o.home_gift_cents = 0 and g.usd_cents = 425 and g.inr_paise = 39100 and g.keep_pct = 0
          and g.funded_by = 'iwc' and g.status = 'to_send' and s.home_gift_id = g.id and s.outcome = 'gift'
   from public.orders o join public.home_gifts g on g.order_id = o.id join public.order_savings s on s.order_id = o.id
   where o.id = tests.id('o_gift')),
  'the saving goes to the desk as an IWC gift; the customer paid only the order');
select tests.assert(
  (select (p.coins - p.saved_coins) between 30 and 98 and p.saved_coins = 0 from public.profiles p where p.id = tests.id('sender')),
  'and no Coins');

select tests.act_as(tests.id('sender'));
select tests.assert(
  (select d -> 'saving' ->> 'outcome' = 'gift' and (d -> 'saving' ->> 'save_cents')::int = 425
          and d -> 'home_gift' ->> 'funded_by' = 'iwc'
   from (select public.store_my_order((select order_number from public.orders where id = tests.id('o_gift')))) x(d)),
  'the order page reads the saving and its gift');
select tests.assert(
  (select s ->> 'save_pct' = '5.00' and (s ->> 'inr_per_usd')::numeric = 92 from public.store_send_home() s),
  'the bag reads the 5% and the day''s rate, nothing kept');
select tests.assert_fails($$select public.admin_saving_gift_failed(tests.id('o_gift'), 'x')$$, 'admin_only',
  'a customer cannot turn a gift into Coins');
reset role;

-- ---------------------------------------------------------------- the desk could not send it: it becomes Coins
select tests.act_as(tests.id('admin'));
select public.admin_saving_gift_failed((select id from public.home_gifts where order_id = tests.id('o_gift')), 'Wrong UPI');
reset role;
select tests.assert(
  (select g.status = 'cancelled' and s.outcome = 'coins' and s.gift_failed and s.credited_at is not null
   from public.home_gifts g join public.order_savings s on s.order_id = g.order_id where g.order_id = tests.id('o_gift')),
  'a gift that cannot go becomes the customer''s Coins');
select tests.assert(
  (select saved_coins = 425 from public.profiles where id = tests.id('sender')),
  'all 425 of them');
select tests.assert(
  (select count(*) = 1 from public.email_outbox where kind = 'home_gift_failed'
     and payload ->> 'orderNumber' = (select order_number from public.orders where id = tests.id('o_gift'))),
  'and the customer hears so');

-- ---------------------------------------------------------------- without a saving, an order is made exactly as before
select tests.assert(
  (select pg_temp.save_order(tests.id('sender'), 'sender@example.test', 'pi_save_none', null) is not null
          and not exists (select 1 from public.order_savings s join public.orders o on o.id = s.order_id
                           where o.payment_intent_id = 'pi_save_none')),
  'no saving, no row');

rollback;

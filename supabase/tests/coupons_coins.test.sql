-- D-191: the coupons checkout offers, who may use them, the coins, and the wallet's refill after an order.
begin;
select tests.setup();

select tests.assert(
  (select count(*) = 4 from public.promo_codes where is_public and code in ('WELCOME10', 'SAVE7', 'SAVE12', 'SAVE20')),
  'the four coupons exist and are public');
select tests.assert(
  (select discount_value = 10 and max_discount_cents = 900 and new_customers_only from public.promo_codes where code = 'WELCOME10'),
  '10% up to $9, new customers only');
select tests.assert(
  (select array_agg(discount_value order by min_order_cents) = array[700, 1200, 2000]
          and array_agg(min_order_cents order by min_order_cents) = array[9900, 15000, 19900]
   from public.promo_codes where code in ('SAVE7', 'SAVE12', 'SAVE20')),
  '$7 from $99, $12 from $150, $20 from $199');

-- every account holds 30 to 90 coins of its own
insert into auth.users (id, email)
select gen_random_uuid(), 'coins' || n || '@example.com' from generate_series(1, 60) n;
select tests.assert(
  (select bool_and(p.coins between 30 and 90) and count(distinct p.coins) > 5
   from public.profiles p join auth.users u on u.id = p.id where u.email like 'coins%@example.com'),
  'a new account gets 30 to 90 coins, each its own number');

-- a customer cannot give themselves coins
create temp table buyer on commit drop as
  select p.id, p.coins from public.profiles p join auth.users u on u.id = p.id where u.email = 'coins1@example.com';
grant select on buyer to authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from buyer), 'role', 'authenticated')::text, true);
set local role authenticated;
select tests.assert(
  not has_column_privilege('authenticated', 'public.profiles', 'coins', 'update'),
  'a customer cannot change their coins');
select tests.assert(
  (select pf.coins = b.coins from public.profiles pf, buyer b where pf.id = b.id),
  'but can see their own');
reset role;
select set_config('request.jwt.claims', '', true);

-- what checkout reads
select tests.assert(
  (select (c ->> 'coins')::integer = b.coins and (c ->> 'is_new_customer')::boolean
   from buyer b, public.checkout_context('{}'::uuid[], null, null, b.id, 'coins1@example.com') c),
  'an account with no paid order: its coins, and new');
select tests.assert(
  (select c ->> 'coins' is null and (c ->> 'is_new_customer')::boolean
   from public.checkout_context('{}'::uuid[]) c),
  'a guest has no coins');
select tests.assert(
  (select jsonb_array_length(c -> 'coupons') >= 4 and c -> 'coupons' -> 0 ->> 'code' = 'WELCOME10'
   from public.checkout_context('{}'::uuid[]) c),
  'the coupon box''s list, the first-order one first');
select tests.assert(
  (select c -> 'promo' ->> 'code' = 'WELCOME10' and (c -> 'promo' ->> 'max_discount_cents')::integer = 900
   from public.checkout_context('{}'::uuid[], 'welcome10') c),
  'a new customer may use the first-order coupon, with its most');

-- a paid order: the wallet holds what it held plus 1 to 8, and they are no longer new
insert into public.products (slug, name, product_type, category_id, price_cents, status, published_at)
values ('coin-piece', 'Coin piece', 'food', tests.id('cat_food'), 1000, 'live', now());
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, 'COIN-1', 'One size', 10 from public.products where slug = 'coin-piece';

select tests.assert(
  (select o.order_number is not null
   from buyer b, public.create_order(jsonb_build_object(
     'email', 'coins1@example.com', 'user_id', b.id, 'subtotal_cents', 1000, 'discount_cents', 85, 'shipping_cents', 0,
     'tax_cents', 0, 'total_cents', 915, 'payment_intent_id', 'pi_coins_1',
     'shipping_address', jsonb_build_object('state', 'NJ', 'line1', '1 Main St'),
     'items', jsonb_build_array(jsonb_build_object(
       'variant_id', (select v.id from public.product_variants v where v.sku = 'COIN-1'),
       'quantity', 1, 'unit_price_cents', 1000)))) o),
  'an order is created');
select tests.assert(
  (select pf.coins between b.coins + 1 and b.coins + 8 from public.profiles pf, buyer b where pf.id = b.id),
  'the wallet refills to what it held plus 1 to 8');
select tests.assert(
  (select not (c ->> 'is_new_customer')::boolean and c -> 'promo' = 'null'::jsonb
   from buyer b, public.checkout_context('{}'::uuid[], 'WELCOME10', null, b.id, 'coins1@example.com') c),
  'after a paid order they are not new, and the first-order coupon is refused');
select tests.assert(
  (select not (c ->> 'is_new_customer')::boolean
   from public.checkout_context('{}'::uuid[], null, null, null, 'COINS1@example.com ') c),
  'the same email as a guest is not new either');

-- a refused order leaves the wallet as it was
create temp table before_refusal on commit drop as
  select pf.coins from public.profiles pf, buyer b where pf.id = b.id;
do $$
begin
  perform public.create_order(jsonb_build_object(
    'email', 'coins1@example.com', 'user_id', (select id from buyer), 'subtotal_cents', 999, 'discount_cents', 0,
    'shipping_cents', 0, 'tax_cents', 0, 'total_cents', 999, 'payment_intent_id', 'pi_coins_2',
    'shipping_address', jsonb_build_object('state', 'NJ', 'line1', '1 Main St'),
    'items', jsonb_build_array(jsonb_build_object(
      'variant_id', (select v.id from public.product_variants v where v.sku = 'COIN-1'),
      'quantity', 1, 'unit_price_cents', 1000))));
exception when others then
  null;
end $$;
select tests.assert(
  (select pf.coins = r.coins from public.profiles pf, buyer b, before_refusal r where pf.id = b.id),
  'an order refused leaves the wallet as it was');

rollback;

-- checkout_context (migration 20260928000003): the server's one-round-trip read
-- for pricing a cart. Service role only; only buyable variants; usable promos only;
-- nothing admin-only in the output except the promo id the server needs.
begin;
select tests.setup();
insert into public.promo_codes (code, discount_type, discount_value, min_order_cents)
values ('WELCOME10', 'percentage', 10, 0);
insert into public.promo_codes (code, discount_type, discount_value, valid_until)
values ('EXPIRED', 'fixed', 500, now() - interval '1 day');
insert into public.promo_codes (code, discount_type, discount_value, max_uses, uses_count)
values ('USEDUP', 'fixed', 500, 1, 1);
insert into public.promo_codes (code, discount_type, discount_value, is_active)
values ('OFF', 'fixed', 500, false);
update public.pricing_settings set shipping_flat_cents = 900, free_shipping_min_cents = 10000 where id = 1;

-- Privileges: never callable by visitors or customers (it reads promo_codes).
set local role anon;
select tests.assert_fails(format('select public.checkout_context(array[%L]::uuid[])', tests.id('v_live')), '42501',
  'anon cannot call checkout_context');
reset role;
set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public.checkout_context(array[%L]::uuid[])', tests.id('v_live')), '42501',
  'a customer cannot call checkout_context');
reset role;

set local role service_role;
select set_config('tests.ctx', public.checkout_context(
  array[tests.id('v_live'), tests.id('v_live2'), tests.id('v_placeholder')], 'welcome10')::text, true);

select tests.assert(jsonb_array_length(current_setting('tests.ctx')::jsonb -> 'variants') = 2,
  'INV-8: only the two live variants are returned, the placeholder is not buyable');
select tests.assert(
  (select v ->> 'price_cents' = '5000' and v ->> 'available' = '1' and v ->> 'product_slug' = 'test-live'
          and v ->> 'region_slug' = 'test-region'
   from jsonb_array_elements(current_setting('tests.ctx')::jsonb -> 'variants') v
   where v ->> 'variant_id' = tests.id('v_live')::text),
  'variant line carries the catalog price, availability and product/region slugs');
select tests.assert(
  (select v ->> 'price_cents' from jsonb_array_elements(current_setting('tests.ctx')::jsonb -> 'variants') v
   where v ->> 'variant_id' = tests.id('v_live2')::text) = '6000',
  'a variant price override wins over the product price');
select tests.assert(
  (current_setting('tests.ctx')::jsonb -> 'promo' ->> 'code') = 'WELCOME10'
  and (current_setting('tests.ctx')::jsonb -> 'promo' ->> 'discount_value') = '10',
  'a usable promo code is found case-insensitively');
select tests.assert(
  (current_setting('tests.ctx')::jsonb -> 'shipping') = '{"flat_cents": 900, "free_min_cents": 10000}'::jsonb,
  'shipping settings are returned as stored');
select tests.assert((current_setting('tests.ctx')::jsonb -> 'delivery' ->> 'est_delivery_from') is not null,
  'the next delivery window is included');

select tests.assert(public.checkout_context(array[tests.id('v_live')], 'EXPIRED') -> 'promo' = 'null'::jsonb,
  'an expired promo is not returned');
select tests.assert(public.checkout_context(array[tests.id('v_live')], 'USEDUP') -> 'promo' = 'null'::jsonb,
  'a promo at its use limit is not returned');
select tests.assert(public.checkout_context(array[tests.id('v_live')], 'OFF') -> 'promo' = 'null'::jsonb,
  'an inactive promo is not returned');
select tests.assert(public.checkout_context(array[tests.id('v_live')], '  ') -> 'promo' = 'null'::jsonb,
  'a blank code finds no promo');

select tests.assert(
  not exists (select 1 from tests.json_keys(current_setting('tests.ctx')::jsonb -> 'variants') k
              where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key in the variant lines');
select tests.assert(position('Test Shop' in current_setting('tests.ctx')) = 0
  and position('Secret Town' in current_setting('tests.ctx')) = 0,
  'INV-1: no shop name or origin town in the checkout context');
reset role;

-- D-040: an option without a price refuses checkout (never a guessed fee).
update public.pricing_settings set shipping_flat_cents = null, free_shipping_min_cents = null where id = 1;
set local role service_role;
select tests.assert(
  (public.checkout_context(array[tests.id('v_live')]) -> 'shipping' ->> 'flat_cents') is null,
  'unset shipping is reported as null (checkout must refuse, not guess)');
reset role;
rollback;

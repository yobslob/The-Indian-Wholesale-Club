-- D-208 Phases 3 and 4 (migration 20261129090000): every open country's prices carry its own freight, worked out in the
-- database (no weight leaves it); the US is unchanged; an order abroad is checked at that country's prices; a closed
-- country is refused.
begin;
select tests.setup();

with v as (insert into public.product_variants (product_id, sku, label, qty_listed, price_cents, weight_g)
           values (tests.id('p_live'), 'TEST-WORLD-1', 'World size', 40, 9000, 1000) returning id)
select tests.remember('v_w', (select id from v));

select tests.assert((select count(*) = 233 from public.ship_countries where open), '233 countries open');
select tests.assert(
  (select bool_and(not open) from public.ship_countries where iso2 in ('CU', 'IR', 'KP', 'SY', 'RU', 'BY', 'PK', 'AQ', 'UM')),
  'sanctioned, empty and unserved places are closed (D-209)');
select tests.assert((select inr_per_kg = 2000 and inr_quote_1kg = 1489 from public.ship_countries where iso2 = 'US'),
  'the US keeps ₹2,000 a kg (founder), with ShipGlobal''s quote beside it');

-- a 1 kg piece of the fixture's type: its price moves by 1000 g × (rate − 2000) ÷ (920 × divisor)
create temp table w on commit drop as
  select p.product_type,
         case p.product_type when 'food' then 0.80 when 'home' then 0.50 else 0.60 end as divisor
  from public.products p where p.id = tests.id('p_live');
select tests.assert((select public._country_price_cents(tests.id('v_w'), 'US') = 9000), 'the US price is the price');
select tests.assert((select public._country_price_cents(tests.id('v_w'), 'us') = 9000), 'any case of the code');
select tests.assert(
  (select public._country_price_cents(tests.id('v_w'), 'GB') = 9000 + round(1000 * (1000 - 2000) / (920.0 * w.divisor))::integer from w),
  'the UK (₹1,000 a kg) is cheaper by the freight it saves');
select tests.assert(
  (select public._country_price_cents(tests.id('v_w'), 'AR') = 9000 + round(1000 * (5000 - 2000) / (920.0 * w.divisor))::integer from w),
  'Argentina (₹5,000 a kg) is dearer by the freight it costs');

select tests.act_as(tests.id('cust_a'));
select tests.assert((select public.store_country_prices('ru', array[tests.id('v_w')]) is null), 'a closed country gets no prices');
select tests.assert(
  (select (d -> 'variants' -> tests.id('v_w')::text ->> 'price')::int = public._country_price_cents(tests.id('v_w'), 'GB')
          and not (d::text ~ 'weight|_g"|inr')
   from (select public.store_country_prices('gb', array[tests.id('v_w')], array[tests.id('p_live')]) d) x),
  'the store reads the UK price, and nothing about weights or rupees');
select tests.assert((select jsonb_array_length(public.store_countries()) = 233), 'the store lists the open countries');
reset role;

-- ---------------------------------------------------------------- an order abroad
create function pg_temp.world_order(p_country text, p_unit integer, p_pi text) returns uuid
language sql as $$
  select order_id from public.create_order(jsonb_build_object(
    'email', 'world@example.test', 'user_id', null,
    'shipping_address', jsonb_build_object('fullName', 'Priya Iyer', 'line1', 'Hauptstrasse 5', 'city', 'London',
                                           'zipCode', 'SW1A 1AA', 'country', p_country),
    'items', jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_w'), 'quantity', 1, 'unit_price_cents', p_unit)),
    'subtotal_cents', p_unit, 'total_cents', p_unit, 'payment_intent_id', p_pi));
$$;
select tests.assert(
  (select pg_temp.world_order('GB', public._country_price_cents(tests.id('v_w'), 'GB'), 'pi_world_gb') is not null),
  'an order to the UK at the UK price is made');
select tests.assert(
  (select o.shipping_address ->> 'country' = 'GB' and oi.unit_price_cents = public._country_price_cents(tests.id('v_w'), 'GB')
   from public.orders o join public.order_items oi on oi.order_id = o.id where o.payment_intent_id = 'pi_world_gb'),
  'with its country and its UK price');
select tests.assert_fails($$select pg_temp.world_order('GB', 9000, 'pi_world_us_price')$$, 'price_mismatch',
  'the US price is refused for an order to the UK');
select tests.assert_fails($$select pg_temp.world_order('RU', 9000, 'pi_world_ru')$$, 'country_closed',
  'an order to a closed country is refused');

rollback;

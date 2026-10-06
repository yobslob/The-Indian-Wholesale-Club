-- The pricing engine (migration 24, D-075): the formula, automatic repricing, the daily rate, spices cleared, listings
-- without a price.
begin;
select tests.setup();

-- Simple numbers first: ₹100 per $, no buffer, only goods + freight. A ₹1,000 piece of 1 kg: $10 + $10 = $20.00,
-- rounded up to $20.99.
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, india_handling_paise = 0, freight_cents_per_kg = 1000,
  volumetric_pct = 100, broker_cents_per_shipment = 0, shipment_kg = 1, duty_pct = 0, us_handling_cents = 0,
  us_last_mile_cents_per_kg = 0, us_last_mile_min_cents = 0, returns_allowance_pct = 0, margin_pct = 0,
  card_fee_pct = 0, card_fee_fixed_cents = 0
 where id = 1;
select tests.assert(public._auto_price_cents(100000, 1000) = 2099, 'goods $10 + freight $10, up to $20.99');
select tests.assert(public._auto_price_cents(99900, 1000) = 1999, '$19.99 of cost already ends in .99 and stays');
select tests.assert(public._auto_price_cents(100000, null) is null, 'no weight, no price');

-- Every cost at once (the same case as packages/shared tests/domain.test.ts "autoPrice").
update public.pricing_settings set
  fx_inr_per_usd = 96, fx_buffer_pct = 4, india_handling_paise = 25000, freight_cents_per_kg = 700,
  volumetric_pct = 130, broker_cents_per_shipment = 35000, shipment_kg = 30, duty_pct = 26.5,
  us_handling_cents = 500, us_last_mile_cents_per_kg = 1000, us_last_mile_min_cents = 500, returns_allowance_pct = 5,
  margin_pct = 100,
  card_fee_pct = 3.5, card_fee_fixed_cents = 30
 where id = 1;
select tests.assert(public._auto_price_cents(250000, 800) = 10699,
  'a ₹2,500 piece of 800 g: $106.99, margin on the goods, every cost at cost, then fees (worked out by hand)');

-- Repricing: the auto-priced fixture product follows the settings; a hand-priced one does not.
update public.products set price_auto = true where id = tests.id('p_live');
update public.product_variants set weight_g = 800 where id = tests.id('v_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800), 'a weight on a variant prices the product');
select tests.assert((select price_cents from public.products where id = tests.id('p_draft')) = 5000,
  'a hand-priced product keeps its price');
update public.pricing_settings set margin_pct = 150 where id = 1;
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800), 'a new margin reprices it at once');
update public.categories set default_weight_g = 2000 where id = tests.id('cat_clothing');
update public.product_variants set weight_g = null where product_id = tests.id('p_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 2000), 'without variant weights the category''s weight counts');

-- The daily rate: a simulated ECB answer is applied, prices follow; an implausible one is refused and recorded.
do $$
begin
  if to_regclass('net._http_response') is null then
    return;
  end if;
  update public.pricing_settings set fx_auto = true, fx_updated_at = now() - interval '1 day' where id = 1;
  insert into public.fx_fetches (request_id, requested_at) values (-101, now());
  insert into net._http_response (id, status_code, content, created)
  values (-101, 200, '{"base":"USD","date":"2026-10-06","rates":{"INR":97.5}}', now());
  perform tests.assert(public._fx_refresh() = 'applied', 'the answer is read');
  perform tests.assert((select fx_inr_per_usd = 97.5 and fx_source like 'ECB%' from public.pricing_settings),
    'D-075: the day''s rate is stored with its source');
  perform tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                       public._auto_price_cents(100000, 2000), 'and prices follow it');
  insert into public.fx_fetches (request_id, requested_at) values (-102, now());
  insert into net._http_response (id, status_code, content, created) values (-102, 200, '{"rates":{"INR":150}}', now());
  perform tests.assert(public._fx_refresh() = 'refused', 'a 50% jump is refused');
  perform tests.assert((select fx_inr_per_usd from public.pricing_settings) = 97.5, 'the old rate stays');
  perform tests.assert(exists (select 1 from public.admin_error_events where event = 'fx.rate_refused'),
    'and the refusal shows on Today (B-8)');
end $$;

-- Spices: live only once cleared (D-074).
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('test-spice-x', 'Test spice', 'spice', tests.id('region'), tests.id('cat_spice'), tests.id('vendor'), 900, 'draft')
returning tests.remember('spice_x', id);
select tests.assert_fails(format('update public.products set status = %L where id = %L', 'live', tests.id('spice_x')),
  'products_spice_not_live', 'not cleared: a spice stays a draft');
update public.pricing_settings set spices_cleared = true where id = 1;
update public.products set status = 'live' where id = tests.id('spice_x');
select tests.assert((select status = 'live' from public.products where id = tests.id('spice_x')), 'cleared: it can go live');

-- A listing without a price is priced automatically; without a shop price it needs one.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.remember('auto_listing', public.admin_create_listing(jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Auto saree', 'slug', 'auto-saree', 'shop_price_paise', 300000,
  'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'Dry clean'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'Red', 'qty', 1, 'weight_g', 900)))));
select tests.assert(
  (select price_auto and price_cents = public.admin_price_preview(300000, 900) from public.products
   where id = tests.id('auto_listing')),
  'D-075: entered in ₹, priced in $ by itself');
select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'No price', 'slug', 'no-price', 'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'x'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'One', 'qty', 1)))), 'price_needed',
  'no shop price and no price: the admin is asked for one');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_price_preview(100000, 800)', 'admin_only', 'customers never see the costs');
reset role;

rollback;

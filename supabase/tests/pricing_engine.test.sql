-- The pricing engine (migration 24, D-075; the formula of the Amazon -> door pilot since migration 38, D-109): the
-- formula, automatic repricing, the daily rate, food cleared, listings without a price.
begin;
select tests.setup();

-- Simple numbers first: ₹100 per $, no buffer, only goods + shipping. A ₹1,000 piece of 1 kg at ₹1,000/kg:
-- $10 + $10 = $20.00, up to $20.29 (D-109: endings .29, .49, .79, .99).
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, india_handling_pct = 0, ship_alloc_paise_per_kg = 100000,
  margin_pct = 0, card_fee_pct = 0, card_fee_fixed_cents = 0
 where id = 1;
select tests.assert(public._auto_price_cents(100000, 1000) = 2029, '$20.00 goes up to $20.29');
select tests.assert(public._auto_price_cents(103000, 1000) = 2049, '$20.30 goes up to $20.49');
select tests.assert(public._auto_price_cents(105000, 1000) = 2079, '$20.50 goes up to $20.79');
select tests.assert(public._auto_price_cents(108000, 1000) = 2099, '$20.80 goes up to $20.99');
select tests.assert(public._auto_price_cents(104900, 1000) = 2049, '$20.49 already has an ending and stays');
select tests.assert(public._auto_price_cents(100000, null) is null, 'no weight, no price');

-- The founder's pilot numbers and worked examples (D-109; the same as packages/shared tests/domain.test.ts). Since
-- D-112 the card fees are inside the margin: they no longer change a price.
update public.pricing_settings set
  fx_inr_per_usd = 96.35, fx_buffer_pct = 4, india_handling_pct = 10, ship_alloc_paise_per_kg = 146100,
  margin_pct = 50, card_fee_pct = 3.4, card_fee_fixed_cents = 30
 where id = 1;
select tests.assert(public._auto_price_cents(150000, 450) = 3749, 'D-109: a ₹1,500 kurta of 450 g is $37.49');
select tests.assert(public._auto_price_cents(400000, 900) = 9279, 'D-109: a ₹4,000 saree of 900 g is $92.79');
select tests.assert(public._auto_price_cents(1200000, 2500) = 27349, 'D-109: a ₹12,000 lehenga of 2.5 kg is $273.49');
select tests.assert(public._auto_price_cents(25000, 250) = 1049, 'D-109: a ₹250 spice pack of 250 g at 50% is $10.49');
update public.pricing_settings set card_fee_pct = 10, card_fee_fixed_cents = 500 where id = 1;
select tests.assert(public._auto_price_cents(150000, 450) = 3749, 'D-112: card fees do not change a price');
update public.pricing_settings set card_fee_pct = null, card_fee_fixed_cents = null where id = 1;
select tests.assert(public._auto_price_cents(150000, 450) = 3749, 'D-112: nor does a missing card fee');
update public.pricing_settings set ship_alloc_paise_per_kg = null where id = 1;
select tests.assert(public._auto_price_cents(150000, 450) is null, 'a missing setting gives no price');
update public.pricing_settings set ship_alloc_paise_per_kg = 146100 where id = 1;

-- Repricing: the auto-priced fixture product follows the settings; a hand-priced one does not.
update public.products set price_auto = true where id = tests.id('p_live');
update public.product_variants set weight_g = 800 where id = tests.id('v_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'clothing'), 'a weight on a variant prices the product');
select tests.assert((select price_cents from public.products where id = tests.id('p_draft')) = 5000,
  'a hand-priced product keeps its price');
update public.pricing_settings set margin_clothing_pct = 150 where id = 1;
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'clothing'), 'a new margin reprices it at once');
-- D-111: each type has its own margin; a type without one falls back to the general margin.
update public.pricing_settings set margin_pct = 50, margin_clothing_pct = 50, margin_food_pct = 25, margin_home_pct = 60
where id = 1;
select tests.assert(public._auto_price_cents(150000, 450, 'clothing') = 3749, 'D-111: clothing at 50% (the kurta, $37.49)');
select tests.assert(public._auto_price_cents(25000, 250, 'food') < public._auto_price_cents(25000, 250, 'clothing'),
  'D-111: food at 25% costs less than at 50%');
select tests.assert(public._auto_price_cents(150000, 450, 'home') > public._auto_price_cents(150000, 450, 'clothing'),
  'D-111: home & gifts at 60% costs more than at 50%');
update public.pricing_settings set margin_food_pct = null where id = 1;
select tests.assert(public._auto_price_cents(25000, 250, 'food') = public._auto_price_cents(25000, 250),
  'D-111: no food margin = the general margin');
update public.pricing_settings set margin_food_pct = 25, food_cleared = true where id = 1;
update public.products set product_type = 'food', category_id = tests.id('cat_food') where id = tests.id('p_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'food'), 'D-111: a product that becomes food takes its margin');
update public.products set product_type = 'clothing', category_id = tests.id('cat_clothing') where id = tests.id('p_live');
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

-- Food: live only once cleared (D-074; production has it cleared since D-107).
update public.pricing_settings set food_cleared = false where id = 1;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('test-food-x', 'Test food', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 900, 'draft')
returning tests.remember('food_x', id);
select tests.assert_fails(format('update public.products set status = %L where id = %L', 'live', tests.id('food_x')),
  'products_food_not_live', 'not cleared: food stays a draft');
update public.pricing_settings set food_cleared = true where id = 1;
update public.products set status = 'live' where id = tests.id('food_x');
select tests.assert((select status = 'live' from public.products where id = tests.id('food_x')), 'cleared: it can go live');

-- A listing without a price is priced automatically; without a shop price it needs one.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.remember('auto_listing', public.admin_create_listing(jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Auto saree', 'slug', 'auto-saree', 'shop_price_paise', 300000,
  'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'Dry clean'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'Red', 'qty', 1, 'weight_g', 900)))));
select tests.assert(
  (select price_auto and price_cents = public.admin_price_preview(300000, 900, 'clothing') from public.products
   where id = tests.id('auto_listing')),
  'D-075: entered in ₹, priced in $ by itself');
select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'vendor_id', tests.id('vendor'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'No price', 'slug', 'no-price', 'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'x'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'One', 'qty', 1)))), 'price_needed',
  'no shop price and no price: the admin is asked for one');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_price_preview(100000, 800, ''food'')', 'admin_only', 'customers never see the costs');
reset role;

rollback;

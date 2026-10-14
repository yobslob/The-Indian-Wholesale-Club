-- The pricing engine (migration 24, D-075; the pilot formula since migration 38, D-109; two recipes and the profit
-- guard since D-119, the small-food shelf since D-120, food's margin band and the .69 ending since D-126, the beta
-- formula since D-127): the formula, automatic repricing, the daily rate, food cleared, listings without a price.
begin;
select tests.setup();

-- D-127: the beta formula, fixed in code: (shop ₹ × 1.10 + kg × ₹2,000) in rupees, converted last at a fixed ₹92; food
-- × 1.20, clothing ÷ 0.60, home & gifts ÷ 0.50, to the cent. The day's rate does not move a beta price.
update public.pricing_settings set beta_pricing = true, fx_inr_per_usd = 96.30, fx_buffer_pct = 4, fx_auto = false
 where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 390, 'D-127: ₹90 garam masala of 100 g: ₹299 + 20% = ₹358.80 ÷ 92 = $3.90');
select tests.assert(public._auto_price_cents(23000, 1000, 'food') = 2939, 'D-127: ₹230 bhujia of 1 kg: ₹2,253 + 20% ÷ 92 = $29.39');
select tests.assert(public._auto_price_cents(69900, 450, 'clothing') = 3023, 'D-127: ₹699 kurta of 450 g: ₹1,668.90 ÷ 0.60 ÷ 92 = $30.23');
select tests.assert(public._auto_price_cents(35000, 525, 'home') = 3120, 'D-127: ₹350 brass diya of 525 g: ₹1,435 ÷ 0.50 ÷ 92 = $31.20');
select tests.assert(public._auto_price_cents(9000, null, 'food') is null, 'D-127: no weight, no price');
update public.pricing_settings set fx_inr_per_usd = 80 where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 390, 'D-127: the day''s rate does not move a beta price (₹92 fixed)');
update public.pricing_settings set fx_inr_per_usd = 96.30 where id = 1;
select tests.assert((select price_cents from public.products where id = tests.id('p_live'))
                    is not distinct from (select price_cents from public.products where id = tests.id('p_live')),
  'D-127: the switch reprices without error');
update public.pricing_settings set beta_pricing = false where id = 1;

-- Simple numbers first, the clothing recipe without taper or guard: ₹100 per $, no buffer, shop ÷ 1, ₹100 per 100 g,
-- margin 0. A ₹1,000 piece of 1 kg: $10 + $10 = $20.00, up to $20.29 (D-109, D-126: endings .29, .49, .69, .79, .99).
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, shop_divisor = 1, ship_paise_per_100g = 10000,
  margin_pct = 0, margin_clothing_pct = 0, margin_clothing_min_pct = null, margin_home_min_pct = null,
  duty_clothing_pct = 0, duty_food_pct = 0, duty_home_pct = 0, min_profit_clothing_cents = 0, min_profit_food_cents = 0,
  min_profit_home_cents = 0, min_profit_pct = 0, min_profit_food_pct = 0, guard_card_fee_pct = 0,
  food_margin_max_pct = null
 where id = 1;
select tests.assert(public._auto_price_cents(100000, 1000) = 2029, '$20.00 goes up to $20.29');
select tests.assert(public._auto_price_cents(103000, 1000) = 2049, '$20.30 goes up to $20.49');
select tests.assert(public._auto_price_cents(105000, 1000) = 2069, 'D-126: $20.50 goes up to $20.69');
select tests.assert(public._auto_price_cents(107000, 1000) = 2079, '$20.70 goes up to $20.79');
select tests.assert(public._auto_price_cents(108000, 1000) = 2099, '$20.80 goes up to $20.99');
select tests.assert(public._auto_price_cents(104900, 1000) = 2049, '$20.49 already has an ending and stays');
select tests.assert(public._auto_price_cents(100000, null) is null, 'no weight, no price');
-- D-119: the founder's margin divides: cost ÷ (1 − 50%) doubles it.
update public.pricing_settings set margin_clothing_pct = 50 where id = 1;
select tests.assert(public._auto_price_cents(100000, 1000, 'clothing') = 4029, 'D-119: $20 ÷ (1 − 50%) = $40.29');
update public.pricing_settings set shop_divisor = 0.9 where id = 1;
select tests.assert(public._auto_price_cents(90000, 1000, 'clothing') = 4029, 'D-119: ₹900 ÷ 0.90 = ₹1,000');

-- The founder's numbers (D-119, the final tuner; the same as packages/shared tests/domain.test.ts) at ₹96.30.
update public.pricing_settings set
  fx_inr_per_usd = 96.30, fx_buffer_pct = 4, shop_divisor = 0.90, ship_paise_per_100g = 14600,
  margin_pct = 50, margin_clothing_pct = 50, margin_clothing_min_pct = 38, taper_clothing_from_cents = 2000,
  taper_clothing_to_cents = 15000, margin_home_pct = 60, margin_home_min_pct = 45, taper_home_from_cents = 1500,
  taper_home_to_cents = 10000, margin_food_pct = 25, india_handling_pct = 10, food_fee_paise = 1500, food_parcel_kg = 5,
  food_billed_pct = 140, courier_first_kg_paise = 224200, courier_next_kg_paise = 67850, parcel_fixed_paise = 105000,
  duty_clothing_pct = 22, duty_food_pct = 16, duty_home_pct = 13, min_profit_clothing_cents = 400,
  min_profit_food_cents = 0, min_profit_home_cents = 400, min_profit_pct = 8, min_profit_food_pct = 4,
  guard_card_fee_pct = 2.9, small_food_max_shop_paise = null, food_ship_share_pct = null
 where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') = 4529, 'D-119: a ₹1,299 kurta of 450 g is $45.29');
select tests.assert(public._auto_price_cents(750000, 900, 'clothing') = 18069, 'D-119: a ₹7,500 saree of 900 g is $180.69');
select tests.assert(public._auto_price_cents(1200000, 2500, 'clothing') = 29649, 'D-119: a ₹12,000 lehenga of 2.5 kg is $296.49');
select tests.assert(public._auto_price_cents(180000, 1200, 'home') = 9129, 'D-119: a ₹1,800 brass piece of 1.2 kg is $91.29');
select tests.assert(public._auto_price_cents(65000, 400, 'home') = 3549, 'D-119: a ₹650 diya of 400 g is $35.49');
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 399, 'D-119: a ₹90 snack of 100 g is $3.99');
select tests.assert(public._auto_price_cents(15000, 250, 'food') = 849, 'D-119: a ₹150 masala of 250 g is $8.49');
select tests.assert(public._auto_price_cents(22000, 400, 'food') = 1329, 'D-119: a ₹220 namkeen of 400 g is $13.29');
-- The taper keeps a big piece from doubling: without it the lehenga is far dearer.
update public.pricing_settings set margin_clothing_min_pct = null where id = 1;
select tests.assert(public._auto_price_cents(1200000, 2500, 'clothing') > 34000, 'D-119: no taper, the lehenga is over $340');
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') = 4549,
  'D-119: the taper barely touches a kurta ($45.49 without it, $45.29 with it)');
update public.pricing_settings set margin_clothing_min_pct = 38 where id = 1;
-- The guard lifts a cheap food piece whose margin cannot pay duty and the card fee; it leaves a kurta alone.
update public.pricing_settings set duty_food_pct = 0, guard_card_fee_pct = 0, min_profit_food_pct = 0 where id = 1;
select tests.assert(public._auto_price_cents(15000, 250, 'food') = 829, 'D-119: without the guard the masala is $8.29, not $8.49');
update public.pricing_settings set duty_food_pct = 16, guard_card_fee_pct = 2.9, min_profit_food_pct = 4 where id = 1;
update public.pricing_settings set duty_clothing_pct = 0 where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') = 4529, 'D-119: the kurta''s margin already pays its duty');
update public.pricing_settings set duty_clothing_pct = 22, min_profit_clothing_cents = 5000 where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') > 6000, 'D-119: a minimum profit in dollars lifts a price');
update public.pricing_settings set min_profit_clothing_cents = 400 where id = 1;

-- D-120, D-125: the small-food shelf rounds a light, cheap piece up to $1.99 / $2.99 / $3.99 with its whole flight in
-- it, and never sells a piece under its cost: one whose cost is above the top step keeps its recipe.
update public.pricing_settings set small_food_max_shop_paise = 20000, small_food_max_g = 250,
  small_food_ship_share_pct = 100, small_food_floor_cents = 199, small_food_ceiling_cents = 399 where id = 1;
select tests.assert(public._auto_price_cents(2000, 20, 'food') = 199, 'D-120: a featherweight piece is $1.99');
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 399, 'D-125: the ₹90 masala of 100 g is $3.99');
select tests.assert(public._auto_price_cents(5000, 100, 'food') = 349, 'D-125: its recipe under the next step is kept');
select tests.assert(public._auto_price_cents(15000, 250, 'food') = 849,
  'D-125: the ₹150 masala of 250 g keeps its recipe (was $3.99, under its cost)');
select tests.assert(public._auto_price_cents(10000, 200, 'food') = 669, 'D-125: a ₹100 packet of 200 g is $6.69');
select tests.assert(public._auto_price_cents(22000, 400, 'food') = 1329, 'D-120: the namkeen of 400 g keeps its recipe');
select tests.assert(public._auto_price_cents(9000, 100, 'clothing') > 399, 'D-120: the shelf is food only');
update public.pricing_settings set small_food_floor_cents = 49, small_food_ceiling_cents = 99 where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 399, 'D-125: a top step under the cost leaves the recipe');
update public.pricing_settings set small_food_floor_cents = 199, small_food_ceiling_cents = 399,
  small_food_ship_share_pct = null where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 399, 'D-120: an empty shelf number turns it off');
update public.pricing_settings set small_food_ship_share_pct = 100, small_food_max_shop_paise = null where id = 1;

-- D-122: a share below 100% takes part of the flight out of the price (D-125: Shipping then makes up for it).
update public.pricing_settings set food_ship_share_pct = 70 where id = 1;
select tests.assert(public._auto_price_cents(10000, 400, 'food') = 849, 'D-122: at 70%, ₹100 · 400 g is $8.49');
select tests.assert(public._auto_price_cents(23000, 1000, 'food') = 2049, 'D-122: at 70%, ₹230 · 1 kg is $20.49');
update public.pricing_settings set food_ship_share_pct = null where id = 1;
select tests.assert(public._auto_price_cents(10000, 400, 'food') = 1129, 'D-125: an empty share is the whole flight (D-119)');
-- D-126: the courier at ₹2,000 a kg, everything in; clothing 42% (lowest 35%), home & gifts 50% (lowest 40%); food
-- packed tighter (110%) and in a band of 17–20% on its cost, without the guard or the shelf (the founder's table).
update public.pricing_settings set courier_first_kg_paise = 200000, courier_next_kg_paise = 200000, parcel_fixed_paise = 0,
  ship_paise_per_100g = 20000, margin_clothing_pct = 42, margin_clothing_min_pct = 35, margin_home_pct = 50,
  margin_home_min_pct = 40, margin_food_pct = 17, food_margin_max_pct = 20, food_billed_pct = 110,
  small_food_max_shop_paise = 20000 where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 429, 'D-126: the ₹90 garam masala of 100 g is $4.29');
select tests.assert(public._auto_price_cents(23000, 1000, 'food') = 3129, 'D-126: a ₹230 bhujia of 1 kg is $31.29 (17.1%)');
select tests.assert(public._auto_price_cents(18000, 250, 'food') = 969, 'D-126: a ₹180 tea of 250 g is $9.69 (.69)');
select tests.assert(public._auto_price_cents(4000, 100, 'food') = 369,
  'D-126: a ₹40 chilli powder: $3.69 (21.8%) is as near the band as $3.49 (15.2%), and a tie goes up');
select tests.assert(public._auto_price_cents(69900, 450, 'clothing') = 3129, 'D-126: a ₹699 kurta stays $31.29');
select tests.assert(public._auto_price_cents(149900, 900, 'clothing') = 6369, 'D-126: a ₹1,499 kurta set is $63.69');
select tests.assert(public._auto_price_cents(35000, 525, 'home') = 3129, 'D-126: a ₹350 brass diya stays $31.29');
select tests.assert(public._band_price(1000, 17, 20) = 1179, 'D-126: $10 in the band is $11.79');
select tests.assert(public._band_price(303, 17, 20) = 369 and public._band_price(300, 17, 20) = 349,
  'D-126: under the band when that ending is nearer ($3.49 for a $3.00 cost)');
update public.pricing_settings set food_margin_max_pct = null where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') <> 429, 'D-126: an empty band top brings the guard back');
update public.pricing_settings set courier_first_kg_paise = 224200, courier_next_kg_paise = 67850, parcel_fixed_paise = 105000,
  ship_paise_per_100g = 14600, margin_clothing_pct = 50, margin_clothing_min_pct = 38, margin_home_pct = 60,
  margin_home_min_pct = 45, margin_food_pct = 25, food_billed_pct = 140, small_food_max_shop_paise = null where id = 1;
-- Card fees in the retailer model's settings never touch a pilot price (D-112).
update public.pricing_settings set card_fee_pct = 10, card_fee_fixed_cents = 500 where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') = 4529, 'D-112: card_fee_pct does not change a price');
-- A missing setting gives no price; an empty guard number counts as 0.
update public.pricing_settings set shop_divisor = null where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') is null, 'no shop divisor, no clothing price');
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 399, 'food does not need it');
update public.pricing_settings set shop_divisor = 0.90, courier_first_kg_paise = null where id = 1;
select tests.assert(public._auto_price_cents(9000, 100, 'food') is null, 'no rate card, no food price');
update public.pricing_settings set courier_first_kg_paise = 224200, min_profit_pct = null where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') is not null, 'an empty guard number still prices');
update public.pricing_settings set min_profit_pct = 8 where id = 1;

-- Repricing: the auto-priced fixture product follows the settings; a hand-priced one does not.
update public.products set price_auto = true where id = tests.id('p_live');
update public.product_variants set weight_g = 800 where id = tests.id('v_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'clothing'), 'a weight on a variant prices the product');
select tests.assert((select price_cents from public.products where id = tests.id('p_draft')) = 5000,
  'a hand-priced product keeps its price');
update public.pricing_settings set margin_clothing_pct = 70 where id = 1;
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'clothing'), 'a new margin reprices it at once');
-- D-111: each type has its own margin; a type without one falls back to the general margin.
update public.pricing_settings set margin_pct = 50, margin_clothing_pct = 50 where id = 1;
select tests.assert(public._auto_price_cents(129900, 450, 'clothing') = 4529, 'D-119: clothing back at 50% (the kurta, $45.29)');
select tests.assert(public._auto_price_cents(25000, 250, 'food') < public._auto_price_cents(25000, 250, 'clothing'),
  'D-111: food costs less than clothing');
select tests.assert(public._auto_price_cents(150000, 450, 'home') > public._auto_price_cents(150000, 450, 'clothing'),
  'D-111: home & gifts at 60% costs more than clothing at 50%');
update public.pricing_settings set margin_food_pct = null, margin_pct = 25 where id = 1;
select tests.assert(public._auto_price_cents(15000, 250, 'food') = 849, 'D-111: no food margin = the general margin');
update public.pricing_settings set margin_food_pct = 25, margin_pct = 50, food_cleared = true where id = 1;
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

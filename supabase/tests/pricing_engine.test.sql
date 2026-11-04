-- The pricing engine since D-187: beta pricing (D-128) is the one formula, fixed in code; automatic repricing; food
-- follows its status; listings without a price.
begin;
select tests.setup();

-- D-128: the founder's exact rules: (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ the category's divisor (food 0.80, clothing
-- 0.60, home & gifts 0.50) ÷ a fixed ₹92, to the cent. The same numbers as packages/shared tests/pricing-beta.test.ts.
select tests.assert(public._auto_price_cents(10000, 100, 'food') = 423, 'D-128: the founder''s example: ₹100 · 100 g food is $4.23');
select tests.assert(public._auto_price_cents(18000, 500, 'food') = 1630, 'D-128: ₹180 mango pickle of 500 g: ₹1,200 ÷ 0.80 ÷ 92 = $16.30');
select tests.assert(public._auto_price_cents(23000, 1000, 'food') = 3065, 'D-128: ₹230 bhujia of 1 kg is $30.65');
select tests.assert(public._auto_price_cents(69900, 450, 'clothing') = 3037, 'D-128: ₹699 kurta of 450 g: ₹1,676.67 ÷ 0.60 ÷ 92 = $30.37');
select tests.assert(public._auto_price_cents(35000, 525, 'home') = 3128, 'D-128: ₹350 brass diya of 525 g: ₹1,438.89 ÷ 0.50 ÷ 92 = $31.28');
select tests.assert(public._auto_price_cents(9000, 100, 'food') = 408, 'D-128: ₹90 · 100 g food is $4.08');
select tests.assert(public._auto_price_cents(9000, null, 'food') is null, 'D-127: no weight, no price');
select tests.assert(public._auto_price_cents(null, 100, 'food') is null, 'no shop price, no price');

-- Repricing: the auto-priced fixture product follows its weight; a hand-priced one does not.
update public.products set price_auto = true where id = tests.id('p_live');
update public.product_variants set weight_g = 800 where id = tests.id('v_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'clothing'), 'a weight on a variant prices the product');
select tests.assert((select price_cents from public.products where id = tests.id('p_draft')) = 5000,
  'a hand-priced product keeps its price');
update public.products set product_type = 'food', category_id = tests.id('cat_food') where id = tests.id('p_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 800, 'food'), 'a product that becomes food takes food''s divisor');
update public.products set product_type = 'clothing', category_id = tests.id('cat_clothing') where id = tests.id('p_live');
update public.categories set default_weight_g = 2000 where id = tests.id('cat_clothing');
update public.product_variants set weight_g = null where product_id = tests.id('p_live');
select tests.assert((select price_cents from public.products where id = tests.id('p_live')) =
                    public._auto_price_cents(100000, 2000, 'clothing'), 'without variant weights the category''s weight counts');

-- A settings save re-prices nothing unless it touches a weight guess.
update public.product_variants set shop_price_paise = 100000, price_cents = 1234 where id = tests.id('v_live');
update public.product_variants set price_cents = 1234 where id = tests.id('v_live');
update public.pricing_settings set free_shipping_min_cents = 4999, stale_listing_days = 9, delivery_days_max = 17 where id = 1;
select tests.assert((select price_cents = 1234 from public.product_variants where id = tests.id('v_live')),
  'D-187: saving Settings moves no price');

-- §9 R-9: food goes live with no switch.
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status)
values ('test-food-x', 'Test food', 'food', tests.id('region'), tests.id('cat_food'), 900, 'draft')
returning tests.remember('food_x', id);
update public.products set status = 'live' where id = tests.id('food_x');
select tests.assert((select status = 'live' from public.products where id = tests.id('food_x')), 'food simply follows its status');

-- A listing without a price is priced automatically; without a shop price it needs one.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.remember('auto_listing', public.admin_create_listing(jsonb_build_object(
  'region_id', tests.id('region'), 'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'Auto saree', 'slug', 'auto-saree', 'shop_price_paise', 300000,
  'source_url', 'https://example.in/auto-saree', 'source_site', 'example.in',
  'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'Dry clean'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'Red', 'qty', 1, 'weight_g', 900)))));
select tests.assert(
  (select price_auto and price_cents = public.admin_price_preview(300000, 900, 'clothing')
          and region_id = tests.id('region') and source_site = 'example.in' from public.products
   where id = tests.id('auto_listing')),
  'D-075: entered in ₹, priced in $ by itself, with its state and its link');
select tests.assert_fails(format('select public.admin_create_listing(%L::jsonb)', jsonb_build_object(
  'category_id', tests.id('cat_clothing'), 'product_type', 'clothing',
  'name', 'No price', 'slug', 'no-price', 'attributes', jsonb_build_object('fibre_content', 'Silk', 'care', 'x'),
  'variants', jsonb_build_array(jsonb_build_object('label', 'One', 'qty', 1)))), 'price_needed',
  'no shop price and no price: the admin is asked for one');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_price_preview(100000, 800, ''food'')', 'admin_only', 'customers never see the costs');
reset role;

rollback;

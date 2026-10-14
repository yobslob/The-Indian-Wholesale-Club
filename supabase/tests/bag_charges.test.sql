-- D-111, D-112: small-order charges (store_bag_charges): fixed Shipping and Retailer charges for any bag with a piece
-- coming from India; the free-shipping line comes back with them (the caller waives them from it up). D-119: the bulk
-- saving's two numbers travel with them. D-123: the retailer %, and the food weight with how it comes down.
begin;
select tests.setup();

update public.pricing_settings set
  small_order_shipping_cents = 1879, small_order_retailer_cents = 199, free_shipping_min_cents = 14999,
  bulk_saving_pct = 10, bulk_saving_cap_cents = 2500
where id = 1;

set local role anon;
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  @> '{"free_min_cents": 14999, "shipping_cents": 1879, "retailer_cents": 199, "bulk_saving_pct": 10, "bulk_saving_cap_cents": 2500,
       "retailer_pct": 1.5, "food_weight_cents": 0, "food_off_step_cents": 5000, "food_off_step_pct": 10, "food_off_max_pct": 40}'::jsonb,
  'one piece: shipping $18.79, retailer charges at least $1.99 or 1.5%, no food weight for clothing');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(
     jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 2),
     jsonb_build_object('variant_id', tests.id('v_live2'), 'quantity', 1)))
  @> '{"free_min_cents": 14999, "shipping_cents": 1879, "retailer_cents": 199, "bulk_saving_pct": 10, "bulk_saving_cap_cents": 2500}'::jsonb,
  'D-112: three pieces pay the same fixed parcel charges');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_placeholder'), 'quantity', 1)))
  ->> 'shipping_cents' = '0', 'a piece customers cannot see adds nothing');
select tests.assert(public.store_bag_charges('[]'::jsonb) ->> 'retailer_cents' = '0', 'an empty bag has no charges');
select tests.assert_fails('select public.store_bag_charges(''{}''::jsonb)', 'invalid_bag', 'a bag is a list');
reset role;

-- D-123: the food weight. ₹100 per $, ₹1,000 a kg on the rate card, the label's weight; food carries 30% in its price,
-- so the bag carries 70%: $7.00 a kg. Two 500 g packs = $7.00; a piece already in the US weighs nothing here.
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, courier_first_kg_paise = 100000,
  courier_next_kg_paise = 100000, food_parcel_kg = 1, parcel_fixed_paise = 0, food_billed_pct = 100,
  food_ship_share_pct = 30, food_cleared = true
where id = 1;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('test-bhujia-bag', 'Test bhujia', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 500, 'live');
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'TEST-BHUJIA-BAG', '500 g', 5, 500 from public.products where slug = 'test-bhujia-bag';
select tests.remember('v_food', (select id from public.product_variants where sku = 'TEST-BHUJIA-BAG'));
set local role anon;
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_food'), 'quantity', 2),
                                              jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
   ->> 'food_weight_cents')::int = 700,
  'D-123: two 500 g packs carry $7.00 of food weight; the clothing adds none');
reset role;
update public.pricing_settings set food_ship_share_pct = 100 where id = 1;
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_food'), 'quantity', 2)))
   ->> 'food_weight_cents')::int = 0,
  'D-123: food that carries all its courier in its price adds no food weight');
update public.pricing_settings set food_ship_share_pct = 30, courier_first_kg_paise = null where id = 1;
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_food'), 'quantity', 2)))
   ->> 'food_weight_cents')::int = 0,
  'D-123: no rate card, no food weight (nothing guessed)');

-- Unset amounts charge nothing.
update public.pricing_settings set small_order_shipping_cents = null where id = 1;
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  ->> 'shipping_cents' = '0', 'no shipping amount set, no shipping charge');
-- Pieces already in the US are not in the parcel (D-072).
update public.products set is_us_stock = true where id = tests.id('p_live');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  ->> 'retailer_cents' = '0', 'a US piece adds no charges');

-- The order's retailer charges are part of its shipping, never more.
select tests.assert_fails(
  format('update public.orders set retailer_charge_cents = shipping_cents + 1 where id = %L', tests.id('order_a')),
  '23514', 'retailer charges cannot exceed the shipping they are part of');

-- D-119: no bulk numbers = no bulk saving.
update public.pricing_settings set bulk_saving_pct = null, bulk_saving_cap_cents = null where id = 1;
select tests.assert(
  public.store_bag_charges('[]'::jsonb) ->> 'bulk_saving_pct' = '0' and public.store_bag_charges('[]'::jsonb) ->> 'bulk_saving_cap_cents' = '0',
  'D-119: no bulk numbers, no bulk saving');
-- The order's bulk saving is part of its discount, never more.
select tests.assert_fails(
  format('update public.orders set bulk_saving_cents = discount_cents + 1 where id = %L', tests.id('order_a')),
  '23514', 'D-119: the bulk saving cannot exceed the discount it is part of');

rollback;

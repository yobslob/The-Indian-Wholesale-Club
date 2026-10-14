-- D-111, D-112: small-order charges (store_bag_charges): fixed Shipping and Retailer charges for any bag with a piece
-- coming from India; the free-shipping line comes back with them (the caller waives them from it up). D-119: the bulk
-- saving's two numbers travel with them. D-123: the retailer %. D-125: Shipping is at least the parcel's amount, more
-- when the bag's pieces cannot pay for the parcel; past the line, only what a bag still needs.
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
       "retailer_pct": 1.5, "past_line_cents": 0}'::jsonb,
  'one kurta: Shipping $18.79 (its price pays its parcel), retailer charges at least $1.99 or 1.5%');
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

-- D-125: simple numbers. ₹100 per $, no buffer; the courier ₹3,000 for the first kg, ₹500 for each further kg (billed
-- by the half kg); no duty, no card %, 2% returns, the card's 30¢.
update public.pricing_settings set
  fx_inr_per_usd = 100, fx_buffer_pct = 0, fx_auto = false, courier_first_kg_paise = 300000,
  courier_next_kg_paise = 50000, parcel_fixed_paise = 0, food_billed_pct = 100, food_fee_paise = 0,
  duty_food_pct = 0, duty_clothing_pct = 0, guard_card_fee_pct = 0, card_fee_fixed_cents = 30, food_cleared = true
where id = 1;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, shop_price_paise, status)
values ('test-masala-bag', 'Test masala', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 400, 5000, 'live'),
       ('test-sack-bag', 'Test heavy sack', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 1600, 5000, 'live');
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'TEST-MASALA-BAG', '100 g', 99, 100 from public.products where slug = 'test-masala-bag'
union all
select id, 'TEST-SACK-BAG', '5 kg', 99, 5000 from public.products where slug = 'test-sack-bag';
update public.products set price_auto = false where slug in ('test-masala-bag', 'test-sack-bag');
update public.products set price_cents = 400 where slug = 'test-masala-bag';
update public.products set price_cents = 1600 where slug = 'test-sack-bag';
select tests.remember('v_masala', (select id from public.product_variants where sku = 'TEST-MASALA-BAG'));
select tests.remember('v_sack', (select id from public.product_variants where sku = 'TEST-SACK-BAG'));
set local role anon;
-- One masala: it leaves $3.92 − $0.52 = $3.40; its parcel costs $30.30; ($30.30 − $3.40) ÷ 0.98 = $27.45 → $27.49.
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_masala'), 'quantity', 1)))
   ->> 'shipping_cents')::int = 2749,
  'D-125: one masala pays what its parcel needs, more than $18.79');
-- Forty masalas ($160, past the line): they leave $136 against a $45.30 parcel: nothing more to pay.
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_masala'), 'quantity', 40)))
   ->> 'past_line_cents')::int = 0,
  'D-125: a bag whose prices pay its flight is free past the line');
-- Ten 5 kg sacks at $16 ($160, past the line): they leave $151.65 against a $275.30 parcel and a $1 bulk saving.
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_sack'), 'quantity', 10)))
   ->> 'past_line_cents')::int > 12000,
  'D-125: a bag that cannot pay its flight past the line still pays the rest as Shipping');
reset role;
update public.pricing_settings set courier_first_kg_paise = null where id = 1;
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_masala'), 'quantity', 1)))
   ->> 'shipping_cents')::int = 1879,
  'D-125: no rate card, the parcel''s amount (nothing guessed)');

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

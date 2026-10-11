-- D-111: small-order charges (store_bag_charges): one courier parcel's cost beyond the shipping already in the item
-- prices, and the retailer charges, both with the small-order margin; the free-shipping line comes back with them.
begin;
select tests.setup();

update public.pricing_settings set
  fx_inr_per_usd = 96.35, fx_buffer_pct = 4, fx_auto = false, india_handling_pct = 10, ship_alloc_paise_per_kg = 146100,
  card_fee_pct = 3.4, card_fee_fixed_cents = 30, small_order_margin_pct = 10, courier_first_kg_paise = 224200,
  courier_next_kg_paise = 67850, parcel_handling_paise = 15000, free_shipping_min_cents = 14999
where id = 1;
update public.product_variants set weight_g = 450 where id in (tests.id('v_live'), tests.id('v_live2'));

set local role anon;
-- One 450 g piece: ₹2,242 for the parcel − ₹657.45 already in its price = ₹1,584.55 → $17.13 × 1.10 ÷ 0.966 → $19.79.
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  = '{"free_min_cents": 14999, "shipping_cents": 1979, "retailer_cents": 199}'::jsonb,
  'one kurta: shipping $19.79, retailer charges $1.99 (₹150)');
-- Three pieces, 1.35 kg: the 2 kg rate ₹2,921 − ₹1,972.35 in the prices → $11.79.
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(
     jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 2),
     jsonb_build_object('variant_id', tests.id('v_live2'), 'quantity', 1))) ->> 'shipping_cents')::integer = 1179,
  'three pieces in one parcel cost less shipping each');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_placeholder'), 'quantity', 1)))
  ->> 'shipping_cents' = '0', 'a piece customers cannot see adds nothing');
select tests.assert(public.store_bag_charges('[]'::jsonb) ->> 'retailer_cents' = '0', 'an empty bag has no charges');
select tests.assert_fails('select public.store_bag_charges(''{}''::jsonb)', 'invalid_bag', 'a bag is a list');
reset role;

-- A heavy bag whose prices already carry more than the parcel costs pays no shipping charge.
update public.pricing_settings set ship_alloc_paise_per_kg = 300000 where id = 1;
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 9)))
  ->> 'shipping_cents' = '0', 'no shipping charge when the prices already cover the parcel');
-- Pieces already in the US are not in the parcel (D-072).
update public.products set is_us_stock = true where id = tests.id('p_live');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  ->> 'retailer_cents' = '0', 'a US piece adds no charges');

-- The order's retailer charges are part of its shipping, never more.
select tests.assert_fails(
  format('update public.orders set retailer_charge_cents = shipping_cents + 1 where id = %L', tests.id('order_a')),
  '23514', 'retailer charges cannot exceed the shipping they are part of');

rollback;

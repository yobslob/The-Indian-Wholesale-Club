-- D-111, D-112: small-order charges (store_bag_charges): fixed Shipping and Retailer charges for any bag with a piece
-- coming from India; the free-shipping line comes back with them (the caller waives them from it up). D-119: the bulk
-- saving's two numbers travel with them.
begin;
select tests.setup();

update public.pricing_settings set
  small_order_shipping_cents = 1879, small_order_retailer_cents = 199, free_shipping_min_cents = 14999,
  bulk_saving_pct = 10, bulk_saving_cap_cents = 2500
where id = 1;

set local role anon;
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 1)))
  = '{"free_min_cents": 14999, "shipping_cents": 1879, "retailer_cents": 199, "bulk_saving_pct": 10, "bulk_saving_cap_cents": 2500}'::jsonb,
  'one piece: shipping $18.79, retailer charges $1.99');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(
     jsonb_build_object('variant_id', tests.id('v_live'), 'quantity', 2),
     jsonb_build_object('variant_id', tests.id('v_live2'), 'quantity', 1)))
  = '{"free_min_cents": 14999, "shipping_cents": 1879, "retailer_cents": 199, "bulk_saving_pct": 10, "bulk_saving_cap_cents": 2500}'::jsonb,
  'D-112: three pieces pay the same fixed charges');
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_placeholder'), 'quantity', 1)))
  ->> 'shipping_cents' = '0', 'a piece customers cannot see adds nothing');
select tests.assert(public.store_bag_charges('[]'::jsonb) ->> 'retailer_cents' = '0', 'an empty bag has no charges');
select tests.assert_fails('select public.store_bag_charges(''{}''::jsonb)', 'invalid_bag', 'a bag is a list');
reset role;

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

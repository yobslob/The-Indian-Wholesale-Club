-- D-111, D-112: small-order charges (store_bag_charges): fixed Shipping and Retailer charges for any bag with a piece
-- coming from India; the free-shipping line comes back with them (the caller waives them from it up). D-119: the bulk
-- saving's two numbers travel with them. D-123: the retailer %. D-154: Shipping is $ a kg × the bag's billed kg (one
-- parcel), the same figure struck through once free; without the $ a kg, the fixed parcel amount (D-111). The top-up
-- of D-125 is gone.
begin;
select tests.setup();

update public.pricing_settings set
  small_order_shipping_cents = 1879, small_order_retailer_cents = 199, free_shipping_min_cents = 14999,
  bulk_saving_pct = 10, bulk_saving_cap_cents = 2500, shipping_cents_per_kg = null
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

-- D-154: $18.62 a billed kg: at least 1 kg, then by the half kg, food at its billed % (here 110%).
update public.pricing_settings set shipping_cents_per_kg = 1862, food_billed_pct = 110, food_cleared = true where id = 1;
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
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_masala'), 'quantity', 1)))
  @> '{"shipping_cents": 1862, "shown_shipping_cents": 1862, "past_line_cents": 0}'::jsonb,
  'D-154: one masala is billed 1 kg: $18.62, the same figure struck through once free');
-- ten masalas: 1 kg of label, 1.1 kg billed, so 1.5 kg
select tests.assert(
  (public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_masala'), 'quantity', 10)))
   ->> 'shipping_cents')::int = 2793,
  'D-154: by the half kg, food at its billed %: 1.1 kg is billed 1.5 kg, $27.93');
-- ten 5 kg sacks ($160, past the line): 55 kg billed; nothing more than the per-kg figure, no top-up
select tests.assert(
  public.store_bag_charges(jsonb_build_array(jsonb_build_object('variant_id', tests.id('v_sack'), 'quantity', 10)))
  @> '{"shipping_cents": 102410, "past_line_cents": 0}'::jsonb,
  'D-154: a heavy bag past the line pays no top-up (D-125 gone); its struck figure grows with it');
reset role;

-- Unset amounts charge nothing.
update public.pricing_settings set small_order_shipping_cents = null, shipping_cents_per_kg = null where id = 1;
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

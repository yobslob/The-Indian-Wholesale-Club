-- Heavy-item shipping (founder 2026-10-24, migration 20261028100000): a heavy piece is priced on half its weight and
-- the other half is the bag's Heavy-item shipping, so price + charge = the price on the whole weight (D-128's rules).
begin;
select tests.setup();

insert into public.categories (product_type, slug, name, sort_order) values ('home', 'test-kitchen', 'Test kitchen', 9);
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             shop_price_paise, price_auto)
select x.slug, x.name, 'home', tests.id('region'), c.id, tests.id('vendor'), 5000, 'live', 180000, true
from public.categories c
cross join (values ('test-cooker', 'Steel pressure cooker 3 L'), ('test-kadai', 'Iron kadai')) x(slug, name)
where c.slug = 'test-kitchen';
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g, shop_price_paise)
select p.id, upper(replace(p.slug, '-', '')), 'One size', 10, 3000, 180000 from public.products p
where p.slug in ('test-cooker', 'test-kadai');

create temp table want on commit drop as
select public._auto_price_cents(180000, 1500, 'home') as half, public._auto_price_cents(180000, 3000, 'home') as whole;

select tests.assert((select heavy_item from public.products where slug = 'test-cooker')
                    and not (select heavy_item from public.products where slug = 'test-kadai'),
  'a home piece named a cooker is a heavy item when it is listed; others are not');
select tests.assert(
  (select v.price_cents = w.half and v.heavy_cents = w.whole - w.half
     from public.product_variants v join public.products p on p.id = v.product_id cross join want w
    where p.slug = 'test-cooker'),
  'its option is priced on half its weight and keeps the other half as Heavy-item shipping');
select tests.assert(
  (select p.price_cents = w.half from public.products p cross join want w where p.slug = 'test-cooker'),
  'its card price is the half-weight price');

-- the admin ticks the kadai: priced at once like the cooker
update public.products set heavy_item = true where slug = 'test-kadai';
select tests.assert(
  (select v.price_cents = w.half and v.heavy_cents = w.whole - w.half
     from public.product_variants v join public.products p on p.id = v.product_id cross join want w
    where p.slug = 'test-kadai'),
  'ticking a piece reprices it on half its weight');
update public.products set heavy_item = false where slug = 'test-kadai';
select tests.assert(
  (select v.price_cents = w.whole and v.heavy_cents = 0
     from public.product_variants v join public.products p on p.id = v.product_id cross join want w
    where p.slug = 'test-kadai'),
  'unticking it puts the whole weight back in its price, with no charge');

set local role anon;
create temp table bag on commit drop as
select public.store_bag_charges(jsonb_build_array(
  jsonb_build_object('variant_id', (select v.id from public.store_variants v join public.store_products p on p.id = v.product_id
                                     where p.slug = 'test-cooker'), 'quantity', 2),
  jsonb_build_object('variant_id', (select v.id from public.store_variants v join public.store_products p on p.id = v.product_id
                                     where p.slug = 'test-kadai'), 'quantity', 1))) as c;
reset role;
select tests.assert(
  (select (c ->> 'heavy_cents')::integer = 2 * (w.whole - w.half) and jsonb_array_length(c -> 'heavy_ids') = 1
          and (c ->> 'heavy_line_off_pct')::numeric = 20
     from bag cross join want w),
  'the bag: two cookers'' Heavy-item shipping, which option it is for, and the 20% off from the line');
select tests.assert(
  not exists (select 1 from bag, tests.json_keys(bag.c) k where k = any (tests.forbidden_keys())),
  'INV-1: no weights or operations fields in the bag''s charges');

-- a heavy piece priced by hand carries no charge
update public.products set price_auto = false where slug = 'test-cooker';
select tests.assert(
  (select v.heavy_cents = 0 from public.store_variants v join public.products p on p.id = v.product_id
    where p.slug = 'test-cooker'),
  'a heavy piece priced by hand has no Heavy-item shipping');

rollback;

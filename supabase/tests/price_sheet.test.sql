-- Products → Download Excel (migration 20261015150100, D-128): admins only; one row per product in the page's view,
-- with the shop price and weight that gave it its price (the cheapest option with its own shop price, else the
-- product's own) and the price itself.
begin;
select tests.setup();
update public.pricing_settings set beta_pricing = true where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, shop_price_paise,
                             price_auto, status)
values ('sheet-pickle', 'Sheet mango pickle', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 100,
        18000, true, 'draft');
select tests.remember('pickle', (select id from public.products where slug = 'sheet-pickle'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g, shop_price_paise) values
  (tests.id('pickle'), 'SHEET-1', '500 g', 3, 500, 18000),
  (tests.id('pickle'), 'SHEET-2', '1 kg', 3, 1000, 34000);

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select * from public.admin_price_sheet()', 'admin_only', 'a customer cannot read the sheet');
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select shop_price_paise = 18000 and weight_g = 500 and price_cents = 1630 and product_type = 'food'
     from public.admin_price_sheet() where name = 'Sheet mango pickle'),
  'D-128: the pickle''s cheapest option: ₹180, 500 g, $16.30 (₹1,200 ÷ 0.80 ÷ 92)');
select tests.assert((select count(*) from public.admin_price_sheet('draft') where name = 'Sheet mango pickle') = 1
                    and (select count(*) from public.admin_price_sheet('live') where name = 'Sheet mango pickle') = 0,
  'a status tab exports only its products');
select tests.assert((select count(*) filter (where name = 'Sheet mango pickle') = 1 and bool_and(name ilike '%mango%')
                       from public.admin_price_sheet(null, false, 'sheet mango')),
  'a search exports only what it finds');
select tests.assert((select bool_and(p.is_us_stock) is not false from public.admin_price_sheet(null, true) s
                       join public.products p on p.name = s.name),
  'the US clearance tab exports only pieces in the US');
reset role;

rollback;

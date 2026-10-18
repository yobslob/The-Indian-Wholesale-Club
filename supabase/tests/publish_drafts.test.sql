-- Publish all drafts (migration 20261014120100, D-120): ready drafts go live, the rest stay drafts and are counted;
-- demo listings and US clearance pieces are not touched; admins only.
begin;
select tests.setup();
-- Generic test clothing: D-140's "who it is for" rule has its own test (wears_and_rows.test.sql).
alter table public.products disable trigger products_wears;

-- Ready: a photo, an active option, a piece to sell.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('ready-draft', 'Ready draft', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft');
select tests.remember('ready', (select id from public.products where slug = 'ready-draft'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g) values (tests.id('ready'), 'READY-1', 'M', 5, 450);
insert into public.product_media (product_id, storage_path, is_primary) values (tests.id('ready'), 'products/r/1.jpg', true);

-- Sold out at the shop: a photo and an option, no piece to sell.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('empty-draft', 'Empty draft', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft');
select tests.remember('empty', (select id from public.products where slug = 'empty-draft'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g) values (tests.id('empty'), 'EMPTY-1', 'M', 0, 450);
insert into public.product_media (product_id, storage_path, is_primary) values (tests.id('empty'), 'products/e/1.jpg', true);

-- A demo draft with everything (never touched). tests.setup()'s p_draft has no photo and no option.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, is_placeholder)
values ('demo-draft', 'Demo draft', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000, 'draft', true);
select tests.remember('demo', (select id from public.products where slug = 'demo-draft'));
insert into public.product_variants (product_id, sku, label, qty_listed) values (tests.id('demo'), 'DEMO-1', 'M', 5);
insert into public.product_media (product_id, storage_path, is_primary) values (tests.id('demo'), 'products/d/1.jpg', true);

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_publish_drafts()', 'admin_only', 'a customer cannot publish drafts');
select tests.act_as(tests.id('fake_admin'));
select tests.assert_fails('select public.admin_publish_drafts()', 'admin_only', 'an admin role without the allowlist cannot');

select tests.act_as(tests.id('admin'));
create temp table r on commit drop as select public.admin_publish_drafts() as j;
select tests.assert((select (j ->> 'published')::int = 1 and (j ->> 'no_stock')::int = 1
                            and (j ->> 'no_photo')::int = 1 and (j ->> 'refused')::int = 0
                            and (j ->> 'live_missing_details')::int = 1 from r),
  'one ready draft published (counted as missing its fibre and care); the sold-out one and the one without a photo counted');
reset role;
select tests.assert((select status = 'live' and published_at is not null from public.products where id = tests.id('ready')),
  'the ready draft is live, with its publish date');
select tests.assert((select status = 'draft' from public.products where id = tests.id('empty')), 'the sold-out draft stays a draft');
select tests.assert((select status = 'draft' from public.products where id = tests.id('p_draft')), 'the draft without a photo stays');
select tests.assert((select status = 'draft' from public.products where id = tests.id('demo')), 'a demo draft is never touched');

-- Food that is not cleared (D-074) is refused one by one, and the rest still go.
update public.pricing_settings set food_cleared = false where id = 1;
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status)
values ('food-draft', 'Food draft', 'food', tests.id('region'), tests.id('cat_food'), tests.id('vendor'), 300, 'draft');
select tests.remember('food', (select id from public.products where slug = 'food-draft'));
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g) values (tests.id('food'), 'FOOD-1', '100 g', 5, 100);
insert into public.product_media (product_id, storage_path, is_primary) values (tests.id('food'), 'products/f/1.jpg', true);
update public.product_variants set qty_listed = 3 where product_id = tests.id('empty');
set local role authenticated;
select tests.act_as(tests.id('admin'));
create temp table r2 on commit drop as select public.admin_publish_drafts() as j;
select tests.assert((select (j ->> 'published')::int = 1 and (j ->> 'refused')::int = 1
                            and j ->> 'note' like '%products_food_not_live%' from r2),
  'uncleared food is refused on its own; the restocked draft still goes live');
reset role;
select tests.assert((select status = 'draft' from public.products where id = tests.id('food')), 'the food stays a draft');
select tests.assert((select status = 'live' from public.products where id = tests.id('empty')), 'the restocked draft is live');

rollback;

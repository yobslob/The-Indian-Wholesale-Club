-- Page reads for the approved design (migration 20260930021816, C1): just listed, New arrivals order,
-- quick add, similar items; INV-1 and INV-8 on the new fields.
begin;
select tests.setup();

-- More products in the test region: the newest one (one variant, in stock), a sold-out one-variant product,
-- and one in another clothing category.
insert into public.categories (product_type, slug, name) values ('clothing', 'test-other-clothing', 'Test other clothing');
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, published_at)
values
  ('test-new', 'Test newest product', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() + interval '1 day'),
  ('test-soldout', 'Test sold-out product', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   3000, 'live', now() - interval '2 days'),
  ('test-other', 'Test other-category product', 'clothing', tests.id('region'),
   (select id from public.categories where slug = 'test-other-clothing'), tests.id('vendor'),
   2000, 'live', now() - interval '3 days'),
  -- oldest, but its name sorts first: just listed must still leave it out
  ('test-aaa-oldest', 'AAA oldest product', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   2500, 'live', now() - interval '10 days');
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, upper(slug), 'Free size', case slug when 'test-soldout' then 0 else 3 end
from public.products where slug in ('test-new', 'test-soldout', 'test-other', 'test-aaa-oldest');
-- The fixture's live product has no publish date; give it one between the others (no date sorts last).
update public.products set published_at = now() where id = tests.id('p_live');
select set_config('tests.v_new', (select v.id::text from public.product_variants v
  join public.products p on p.id = v.product_id where p.slug = 'test-new'), true);

set local role anon;

-- Home: just listed
select tests.assert((public.store_home() -> 'just_listed' -> 0 ->> 'slug') = 'test-new',
  'just listed starts with the newest live product');
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(public.store_home() -> 'just_listed')
   with ordinality as x(c, ord)) = array['test-new', 'test-live', 'test-soldout', 'test-other'],
  'just listed = the four newest live products, newest first (the older fifth is left out)');
select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_home() -> 'just_listed') c
              where c ->> 'slug' in ('test-draft', 'test-placeholder')),
  'INV-8: drafts and placeholders never appear in just listed');

-- Region page: newest first, quick add only for one in-stock variant
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'products') with ordinality as x(c, ord))
  = array['test-new', 'test-live', 'test-soldout', 'test-other', 'test-aaa-oldest'],
  'region page cards are newest first (New arrivals), live and non-placeholder only');
select tests.assert(
  (select c -> 'quick_add' ->> 'variant_id' from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
   where c ->> 'slug' = 'test-new')
  = current_setting('tests.v_new'),
  'a one-variant product in stock carries its variant as quick_add');
select tests.assert(
  (select bool_and(c -> 'quick_add' = 'null'::jsonb) from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c
   where c ->> 'slug' in ('test-live', 'test-soldout')),
  'no quick_add for a product with two variants or a sold-out one');
select tests.assert(
  (select bool_and(c ? 'published_at' and (c ->> 'available') is not null)
   from jsonb_array_elements(public.store_region_page('test-region') -> 'products') c),
  'every region card carries published_at and availability');

-- Product page: similar items
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_product_page('test-region', 'test-live') -> 'similar') with ordinality as x(c, ord))
  = array['test-new', 'test-soldout', 'test-aaa-oldest'],
  'similar items: same category, not the product itself, newest first, no drafts or placeholders');
select tests.assert(jsonb_array_length(public.store_product_page('test-region', 'test-other') -> 'similar') = 0,
  'a product alone in its category has no similar items');

-- INV-1 on the new fields
select tests.assert(
  not exists (
    select 1 from (
      select tests.json_keys(public.store_home()) as k
      union all select tests.json_keys(public.store_region_page('test-region'))
      union all select tests.json_keys(public.store_product_page('test-region', 'test-live'))
    ) x where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key in just listed, region cards or similar items');
select tests.assert(
  position('Test Shop' in public.store_home()::text) = 0
  and position('Secret Town' in public.store_product_page('test-region', 'test-new')::text) = 0,
  'INV-1: no shop name or origin town in the new outputs');

select tests.assert_fails(format('select public._store_product_card(%L)', tests.id('p_live')), '42501',
  'anon cannot call the internal card helper');
reset role;

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails(format('select public._store_product_card(%L)', tests.id('p_live')), '42501',
  'customers cannot call the internal card helper');
reset role;

rollback;

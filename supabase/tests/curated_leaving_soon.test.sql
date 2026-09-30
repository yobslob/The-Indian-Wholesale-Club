-- Curated for you and Leaving soon (migration 20260930095920, D-056).
begin;
select tests.setup();

-- Fixture: test-live has 1 piece left after the two setup orders (2 + 1 listed, 2 reserved).
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, is_curated, is_placeholder)
values
  ('cur-new', 'Curated newest', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() + interval '1 day', true, false),
  ('cur-old', 'Curated older', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '5 days', true, false),
  ('not-cur', 'Not curated, 3 left', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '1 day', false, false),
  ('two-left', 'Two left', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '2 days', false, false),
  ('gone', 'Sold out', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '3 days', false, false),
  ('cur-draft', 'Curated draft', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'draft', null, true, false),
  ('cur-ph', 'Curated placeholder', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now(), true, true);
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, upper(slug), 'Free size', case slug when 'two-left' then 2 when 'cur-ph' then 1 when 'gone' then 0 else 3 end
from public.products where slug in ('cur-new', 'cur-old', 'not-cur', 'two-left', 'gone', 'cur-draft', 'cur-ph');

set local role anon;

select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'curated') with ordinality as x(c, ord))
  = array['cur-new', 'cur-old'],
  'Curated for you = the admin''s picks in the region, newest first; no drafts or placeholders (INV-8)');

select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'leaving_soon') with ordinality as x(c, ord))
  = array['test-live', 'two-left'],
  'Leaving soon = live pieces with 1 to 2 left, fewest first (sold out and 3 left are not included)');

select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_product_page('test-region', 'cur-new') -> 'curated') with ordinality as x(c, ord))
  = array['cur-old'],
  'product page Curated for you: the region''s other picks, not the product itself');

select tests.assert(not (public.store_product_page('test-region', 'test-live') -> 'product') ? 'is_curated',
  'the product itself carries no curation flag');

select tests.assert(
  not exists (select 1 from tests.json_keys(public.store_region_page('test-region')) k where k = any (tests.forbidden_keys())),
  'INV-1: no admin-only key in the new lists');

select tests.assert_fails('select public._leaving_soon_max()', '42501', 'anon cannot call the internal setting helper');
reset role;

-- The limit is a setting (D-056)
update public.pricing_settings set leaving_soon_max = 3 where id = 1;
set local role anon;
select tests.assert(
  (select count(*) from jsonb_array_elements(public.store_region_page('test-region') -> 'leaving_soon')) = 4,
  'raising the Leaving soon limit to 3 lets pieces with 3 left in (capped at four cards)');
reset role;

select tests.assert_fails('update public.pricing_settings set leaving_soon_max = 0 where id = 1', '23514',
  'the Leaving soon limit must be at least 1');

rollback;

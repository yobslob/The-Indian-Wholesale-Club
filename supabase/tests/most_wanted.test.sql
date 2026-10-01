-- Most wanted (migration 20260930160000, D-058): the region's live pieces ordered most in the last 30 days.
begin;
select tests.setup();

-- Fixture. test-live already has 2 pieces ordered by the two setup orders (and 1 left).
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, is_placeholder)
values
  ('mw-top', 'Ordered most', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '9 days', false),
  ('mw-tie-old', 'One ordered, older', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '8 days', false),
  ('mw-tie-new', 'One ordered, newer', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '1 day', false),
  ('mw-tie-mid', 'One ordered, in between', 'clothing', tests.id('region'), tests.id('cat_clothing'),
   tests.id('vendor'), 4000, 'live', now() - interval '6 days', false),
  ('mw-cancelled', 'Only in a cancelled order', 'clothing', tests.id('region'), tests.id('cat_clothing'),
   tests.id('vendor'), 4000, 'live', now() - interval '2 days', false),
  ('mw-old', 'Only ordered 40 days ago', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now() - interval '3 days', false),
  ('mw-line-refunded', 'Its line was refunded', 'clothing', tests.id('region'), tests.id('cat_clothing'),
   tests.id('vendor'), 4000, 'live', now() - interval '4 days', false),
  ('mw-sold-out', 'Sold out after orders', 'clothing', tests.id('region'), tests.id('cat_clothing'),
   tests.id('vendor'), 4000, 'live', now() - interval '5 days', false),
  ('mw-never', 'Never ordered', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'),
   4000, 'live', now(), false);
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, upper(slug), 'Free size', case slug when 'mw-sold-out' then 2 else 10 end
from public.products where slug like 'mw-%';

-- One paid order per call (create_order is what checkout calls); returns the order id.
create function pg_temp.buy(p_slug text, p_qty integer, p_ref text) returns uuid
language plpgsql as $$
declare v_order record;
begin
  select * into v_order from public.create_order(jsonb_build_object(
    'email', 'cust.a@example.test', 'user_id', tests.id('cust_a'),
    'shipping_address', jsonb_build_object('fullName', 'Cust A', 'line1', '1 Main St', 'city', 'Austin',
                                           'state', 'TX', 'zipCode', '73301'),
    'items', jsonb_build_array(jsonb_build_object(
      'variant_id', (select v.id from public.product_variants v join public.products p on p.id = v.product_id
                     where p.slug = p_slug), 'quantity', p_qty, 'unit_price_cents', 4000)),
    'subtotal_cents', 4000 * p_qty, 'total_cents', 4000 * p_qty, 'payment_intent_id', 'pi_mw_' || p_ref));
  return v_order.order_id;
end $$;

select pg_temp.buy('mw-top', 2, 'top1');
select pg_temp.buy('mw-top', 3, 'top2');
select pg_temp.buy('mw-tie-old', 1, 'tie_old');
select pg_temp.buy('mw-tie-new', 1, 'tie_new');
select pg_temp.buy('mw-tie-mid', 1, 'tie_mid');
select tests.remember('o_cancelled', pg_temp.buy('mw-cancelled', 9, 'cancelled'));
select tests.remember('o_old', pg_temp.buy('mw-old', 9, 'old'));
select tests.remember('o_refunded', pg_temp.buy('mw-line-refunded', 9, 'refunded'));
update public.orders set status = 'cancelled' where id = tests.id('o_cancelled');
update public.orders set created_at = now() - interval '40 days' where id = tests.id('o_old');
update public.order_items set status = 'refunded' where order_id = tests.id('o_refunded');
select pg_temp.buy('mw-sold-out', 2, 'sold_out');

set local role anon;

select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'most_wanted') with ordinality as x(c, ord))
  = array['mw-top', 'test-live', 'mw-tie-new', 'mw-tie-mid', 'mw-tie-old'],
  'Most wanted = most pieces ordered in 30 days, ties to the newer listing');

select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_region_page('test-region') -> 'most_wanted') c
              where c ->> 'slug' in ('mw-cancelled', 'mw-old', 'mw-line-refunded', 'mw-sold-out', 'mw-never')),
  'cancelled orders, orders older than 30 days, refunded lines, sold-out and never-ordered pieces do not count');

select tests.assert(
  not exists (select 1 from jsonb_array_elements(public.store_region_page('test-region') -> 'most_wanted') c,
                            tests.json_keys(c) k
              where k in ('ordered', 'quantity', 'count', 'sold')),
  'D-003: only the ranking reaches customers, never the order counts');
reset role;

-- Two more pieces of the oldest tied listing (3 in all) move it past test-live (2) and the newer ties (1).
select pg_temp.buy('mw-tie-old', 2, 'tie_old2');
set local role anon;
select tests.assert(
  (select array_agg(c ->> 'slug' order by ord) from jsonb_array_elements(
     public.store_region_page('test-region') -> 'most_wanted') with ordinality as x(c, ord))
  = array['mw-top', 'mw-tie-old', 'test-live', 'mw-tie-new', 'mw-tie-mid'],
  'the count decides before the listing date');
reset role;

-- The row holds twelve (D-062). Twelve newer pieces ordered once each must not push out an older piece ordered more.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status,
                             published_at, is_placeholder)
select 'mw-new-' || i, 'Newer, ordered once ' || i, 'clothing', tests.id('region'), tests.id('cat_clothing'),
       tests.id('vendor'), 4000, 'live', now() + i * interval '1 hour', false
from generate_series(1, 12) i;
insert into public.product_variants (product_id, sku, label, qty_listed)
select id, upper(slug), 'Free size', 5 from public.products where slug like 'mw-new-%';
select pg_temp.buy('mw-new-' || i, 1, 'new' || i) from generate_series(1, 12) i;
set local role anon;
select tests.assert(
  jsonb_array_length(public.store_region_page('test-region') -> 'most_wanted') = 12
  and exists (select 1 from jsonb_array_elements(public.store_region_page('test-region') -> 'most_wanted') c
              where c ->> 'slug' = 'mw-tie-old'),
  'at most twelve, and the cut goes by count: the older piece with 3 orders stays, newer single orders drop');
reset role;

-- No qualifying orders: the list is empty (the page hides the section).
update public.orders set status = 'cancelled';
set local role anon;
select tests.assert(
  public.store_region_page('test-region') -> 'most_wanted' = '[]'::jsonb,
  'with no counted orders Most wanted is empty');
reset role;

rollback;

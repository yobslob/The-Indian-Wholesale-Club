-- Insights (migration 20): sales counted the same way as the order rules, search recorded without the person, demand
-- signals; admin only.
begin;
select tests.setup();

-- order_a (Free size × 1, $50, tax $4) and order_b (Large × 1, $60) are paid. Order B is cancelled in full.
update public.orders set status = 'cancelled', payment_status = 'refunded', refunded_cents = total_cents
 where id = tests.id('order_b');
-- Only this test's orders: they were placed at now() (the transaction's start), real local orders are older.
set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  (select public.admin_sales(now()) -> 'totals') @> '{"pieces": 1, "revenue_cents": 5000}'::jsonb,
  'only the active lines of paid, not-cancelled orders count (order A: 1 piece, $50.00 before tax)');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.admin_sales(now()) -> 'by_shop') s
          where s ->> 'name' = 'Test Shop' and (s ->> 'shop_cost_paise')::int = 100000),
  'by shop: what was sold and what the shop is paid for it');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.admin_sales(now()) -> 'by_category') c
          where c ->> 'name' = 'Test clothing' and (c ->> 'pieces')::int = 1),
  'by category');
select tests.assert((public.admin_sales(now() + interval '1 day') -> 'totals' ->> 'pieces')::int = 0,
  'a period counts only orders placed in it');

select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_sales()', 'admin_only', 'customers never see sales');
select tests.assert_fails('select public.admin_demand()', 'admin_only', 'or demand');
insert into public.wishlists (user_id, product_id) values (tests.id('cust_a'), tests.id('p_live'));
reset role;

-- Searching (a visitor): the first page records the words and the matches, later pages do not.
set local role anon;
select tests.assert((select count(*) from public.store_search('  Test   LIVE ')) = 1, 'the live test product is found');
select tests.assert((select count(*) from public.store_search('test live', 24)) = 0, 'the second page is empty');
select tests.assert((select count(*) from public.store_search('zzzunlisted')) = 0, 'nothing matches this');
select tests.assert((select count(*) from public.store_search('Test draft product')) = 0, 'drafts are never found');
select tests.assert_fails('select count(*) from public.search_queries', '42501', 'visitors cannot read the search log');
reset role;
select tests.assert(
  (select array_agg(query || ':' || results order by id) from public.search_queries
   where created_at = now()) = array['test live:1', 'zzzunlisted:0', 'test draft product:0'],
  'each first page is recorded once, normalised, with its match count; no user or address is stored');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.admin_demand() -> 'empty_searches') e where e ->> 'query' = 'zzzunlisted'),
  'searches that found nothing show, as what to list next');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.admin_demand() -> 'most_saved') m
          where m ->> 'name' = 'Test live product' and (m ->> 'saves')::int >= 1),
  'saved pieces are counted across customers');
reset role;

rollback;

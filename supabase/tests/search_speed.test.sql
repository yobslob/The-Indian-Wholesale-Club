-- Search that reads little (migration 20261108090000, launch QA D-1): counts stop at 1,000 with capped, product_search
-- follows a listing's status by trigger, sold out last from the stock feed, the description only as the last resort,
-- and the time budget: past it, the fix and some-words passes are skipped and the answer says slow (never an error).
begin;
select tests.setup();

-- Made-up words, so the local catalogue never matches them: 1,005 "Qorvane" pieces (one sold out, the newest).
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, wears,
                             attributes, published_at)
select 'qv-' || g, 'Qorvane piece ' || g, 'clothing', tests.id('region'), tests.id('cat_clothing'), 1000 + g, 'live', 'women', '{"fibre_content": "100% cotton", "care": "Hand wash"}', now() - (g || ' hours')::interval
from generate_series(1, 1005) g;
insert into public.product_variants (product_id, sku, label, qty_listed, qty_reserved)
select p.id, 'QV-' || p.slug, 'Free size', 3, case when p.slug = 'qv-1' then 3 else 0 end
from public.products p where p.slug like 'qv-%';
-- one listing names a word only in its description; another has it in its name
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, wears,
                             attributes, description, published_at)
values ('zq-desc', 'Plain stole', 'clothing', tests.id('region'), tests.id('cat_clothing'), 2000,
        'live', 'women', '{"fibre_content": "100% wool", "care": "Dry clean"}', 'Pairs well with a zelquor.', now()),
       ('zq-other', 'Woven shawl', 'clothing', tests.id('region'), tests.id('cat_clothing'), 2000,
        'live', 'women', '{"fibre_content": "100% wool", "care": "Dry clean"}', 'Pairs well with a yandrel.', now()),
       ('zq-name', 'Yandrel wrap', 'clothing', tests.id('region'), tests.id('cat_clothing'), 2000,
        'live', 'women', '{"fibre_content": "100% wool", "care": "Dry clean"}', null, now());
insert into public.product_variants (product_id, sku, label, qty_listed, qty_reserved)
select p.id, 'ZQ-' || p.slug, 'Free size', 3, 0 from public.products p where p.slug like 'zq-%';
select public.refresh_search_words();

create function pg_temp.names(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'name' order by n), '{}') from jsonb_array_elements(p -> 'products') with ordinality x(e, n)
$$;

-- The budget counts from the start of the statement, and db-test.mjs sends this whole file as one: on a slow machine the
-- rows above would use it up. The tests that are about the budget set their own, below.
set local iwc.search_budget_ms = '600000';
set local role anon;
select tests.assert(
  (select (r ->> 'total')::int = 1000 and (r ->> 'all_total')::int = 1000 and (r ->> 'capped')::boolean
          and jsonb_array_length(r -> 'products') = 24 and not (r ->> 'slow')::boolean
   from (select public.store_search_page('qorvane', p_record => false) r) x),
  'counts stop at 1,000 and say so (the page shows 1,000+)');
select tests.assert(
  (select (r ->> 'total')::int = 0 and (r ->> 'all_total')::int = 1000 and not (r ->> 'capped')::boolean
   from (select public.store_search_page('qorvane', p_type => 'food', p_record => false) r) x),
  'a filter that leaves fewer than 1,000 is counted exactly, not capped');
select tests.assert(
  (select jsonb_array_length(r -> 'products') = 500 from (select public.store_search_page('qorvane', p_limit => 500, p_record => false) r) x),
  'a page of up to 500 cards still comes from the best 1,000');
select tests.assert(
  (pg_temp.names(public.store_search_page('qorvane', p_record => false)))[1] = 'Qorvane piece 2',
  'the newest piece that can be bought first; the sold-out newest one is not');
select tests.assert(
  (pg_temp.names(public.store_search_page('qorvane', p_sort => 'price-asc', p_record => false)))[1:2]
    = array['Qorvane piece 2', 'Qorvane piece 3'],
  'price low to high, sold out still last');

-- The description is the last resort: read only when no listing's own words match.
select tests.assert(pg_temp.names(public.store_search_page('zelquor', p_record => false)) = array['Plain stole'],
  'a word only a description has still finds that listing');
select tests.assert(pg_temp.names(public.store_search_page('yandrel', p_record => false)) = array['Yandrel wrap'],
  'but not beside listings whose own words have it');
reset role;

-- The trigger keeps product_search's status: an archived listing is no longer found, a published one is.
update public.products set status = 'archived' where slug = 'qv-2';
select tests.assert(
  (select not s.listed from public.product_search s join public.products p on p.id = s.product_id
   where p.slug = 'qv-2'),
  'archiving a listing takes it out of search''s rows');
set local role anon;
select tests.assert(not ('Qorvane piece 2' = any (pg_temp.names(public.store_search_page('qorvane piece 2', p_limit => 500, p_record => false)))),
  'an archived listing is not found');
reset role;

-- The time budget: the first reading always runs; past the budget the fix and some-words passes are skipped.
set local role anon;
select tests.assert(
  (public.store_search_page('qorvqne', p_record => false) ->> 'mode') = 'fixed',
  'with time, a misspelt word is fixed');
set local iwc.search_budget_ms = '0';
select tests.assert(
  (select r ->> 'mode' = 'none' and (r ->> 'slow')::boolean and r -> 'products' = '[]'::jsonb
   from (select public.store_search_page('qorvqne', p_record => false) r) x),
  'past the budget, no fix is tried and the answer says slow, without an error');
select tests.assert(
  (select r ->> 'mode' = 'all' and not (r ->> 'slow')::boolean and jsonb_array_length(r -> 'products') = 24
   from (select public.store_search_page('qorvane', p_record => false) r) x),
  'a search its words answer is answered whatever the budget');
set local iwc.search_budget_ms = '600000';
reset role;

-- The suggestions count categories and states from product_search.
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.store_search_hints() -> 'categories') c
          where c ->> 'slug' = 'test-clothing' and (c ->> 'count')::int >= 1007),
  'the categories with their pieces, from search''s rows');

rollback;

-- Search (migration 20261030090000, D-160): English stems, synonyms, spelling fixes from the listings' own words, a
-- cut-short last word, "some of your words", states named in the words, ranking (in stock first), the filters and
-- their counts, what is recorded, the hints, the old store_search, the triggers, and nothing a customer may not see.
begin;
select tests.setup();

-- Made-up words, so the local catalogue never matches them.
insert into public.products (slug, name, product_type, region_id, category_id, vendor_id, price_cents, status, wears,
                             attributes, summary, published_at)
values ('zv-kurti', 'Zarvelle kurti', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 3000,
        'live', 'women', '{"fibre_content": "100% cotton", "care": "Hand wash"}', 'Cotton, block printed.', now() - interval '40 days'),
       ('zv-saree', 'Zarvelle saree', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 9000,
        'live', 'women', '{"fibre_content": "100% silk", "care": "Dry clean"}', null, now() - interval '40 days'),
       ('zv-stole-a', 'Zarvelle stole plain', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 2000,
        'live', 'women', '{"fibre_content": "100% wool", "care": "Dry clean"}', null, now()),
       ('zv-stole-b', 'Zarvelle stole woven', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 2500,
        'live', 'women', '{"fibre_content": "100% wool", "care": "Dry clean"}', null, now() - interval '40 days'),
       ('zv-draft', 'Zarvelle draft shawl', 'clothing', tests.id('region'), tests.id('cat_clothing'), tests.id('vendor'), 2500,
        'draft', 'women', '{}', null, null);
insert into public.product_variants (product_id, sku, label, qty_listed, qty_reserved)
select p.id, 'ZV-' || p.slug, 'Free size', case when p.slug = 'zv-stole-a' then 1 else 3 end,
       case when p.slug = 'zv-stole-a' then 1 else 0 end
from public.products p where p.slug like 'zv-%';
select public.refresh_search_words();

create function pg_temp.names(p jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'name' order by n), '{}') from jsonb_array_elements(p -> 'products') with ordinality x(e, n)
$$;

set local role anon;
select tests.assert(pg_temp.names(public.store_search_page('zarvelle kurtis', p_record => false)) = array['Zarvelle kurti'],
  'a plural finds the singular (English stems)');
select tests.assert(pg_temp.names(public.store_search_page('Zarvelle SARI', p_record => false)) = array['Zarvelle saree'],
  'a synonym finds the word the listing uses (sari = saree)');
select tests.assert(
  (select r ->> 'mode' = 'fixed' and r ->> 'fixed' = 'zarvelle saree' and pg_temp.names(r) = array['Zarvelle saree']
   from (select public.store_search_page('zarvele saree', p_record => false) r) x),
  'a misspelt word is read as the nearest word of the listings, and says so');
select tests.assert(
  (select r ->> 'mode' = 'all' and (r ->> 'total')::int = 4 from (select public.store_search_page('zarvel', p_record => false) r) x),
  'a last word cut short is read as a beginning');
select tests.assert(
  (select r ->> 'mode' = 'some' and (r ->> 'total')::int = 4
   from (select public.store_search_page('zarvelle qqqzzzx', p_record => false) r) x),
  'when no piece has every word, the pieces with some of them');
select tests.assert(
  (select r ->> 'mode' = 'none' and (r ->> 'total')::int = 0 and r -> 'products' = '[]'::jsonb
   from (select public.store_search_page('qqqzzzx', p_record => false) r) x),
  'nothing found is nothing');
select tests.assert(
  (select r ->> 'mode' = 'none' from (select public.store_search_page('for the', p_record => false) r) x),
  'only stop words find nothing, quietly');
select tests.assert(
  (select r ->> 'mode' = 'some' and not ('Zarvelle draft shawl' = any (pg_temp.names(r)))
   from (select public.store_search_page('zarvelle shawl', p_limit => 500, p_record => false) r) x),
  'a draft is never found');
select tests.assert(
  not ('Test placeholder product' = any (pg_temp.names(public.store_search_page('test placeholder product', p_limit => 500, p_record => false)))),
  'nor a placeholder');

-- Ranking: the plain stole is sold out (1 listed, 1 reserved) and newer; the woven one in stock comes first.
select tests.assert(
  pg_temp.names(public.store_search_page('zarvelle stole', p_record => false)) = array['Zarvelle stole woven', 'Zarvelle stole plain'],
  'in stock before sold out, whatever is newer');
select tests.assert(
  (pg_temp.names(public.store_search_page('zarvelle', p_record => false)))[4] = 'Zarvelle stole plain',
  'a sold-out piece after every piece that can be bought');
select tests.assert(
  pg_temp.names(public.store_search_page('zarvelle', p_sort => 'price-desc', p_record => false))
    = array['Zarvelle saree', 'Zarvelle kurti', 'Zarvelle stole woven', 'Zarvelle stole plain'],
  'price high to low, sold out still last');
select tests.assert(
  pg_temp.names(public.store_search_page('zarvelle', p_offset => 1, p_limit => 2, p_sort => 'price-asc', p_record => false))
    = array['Zarvelle kurti', 'Zarvelle saree'],
  'pages: offset and limit');

-- States named in the words.
select tests.assert(
  public.store_search_page('test region zarvelle', p_record => false) -> 'named_regions' = '["test-region"]'::jsonb,
  'a state named in the words is given back, to offer its pieces');
select tests.assert(
  (public.store_search_page('zarvelle', p_record => false) -> 'regions' -> 0 ->> 'count')::int = 4,
  'the states with matching pieces and their counts');

-- Filters and counts.
select tests.assert(
  (select (r -> 'types' ->> 'clothing')::int = 4 and (r ->> 'total')::int = 0 and (r ->> 'all_total')::int = 4
   from (select public.store_search_page('zarvelle', p_type => 'food', p_record => false) r) x),
  'a type narrows the pieces; the counts per type stay');
select tests.assert(
  (select (r ->> 'total')::int = 4 and r -> 'categories' -> 0 ->> 'slug' = 'test-clothing'
   from (select public.store_search_page('zarvelle', p_category => 'test-clothing', p_region => 'test-region', p_record => false) r) x),
  'a category and a state narrow it too, with their counts');
select tests.assert(
  (public.store_search_page('zarvelle', p_region => 'kerala', p_record => false) ->> 'total')::int = 0,
  'another state has none of them');

-- Nothing a customer may not see: a card carries only the store's card fields.
select tests.assert(
  (select bool_and(k in ('id', 'slug', 'name', 'product_type', 'region_slug', 'region_name', 'category_slug',
                         'category_name', 'price_cents', 'primary_image_path', 'pack', 'coming_soon', 'options',
                         'quick_days'))
   from jsonb_array_elements(public.store_search_page('zarvelle', p_record => false) -> 'products') e,
        jsonb_object_keys(e) k),
  'cards carry no shop, cost or source');

-- The old search (the app on phones): the same pieces in the same order.
select tests.assert(
  (select array_agg(name order by n) from (select name, row_number() over () as n from public.store_search('zarvelle')) s)
    = pg_temp.names(public.store_search_page('zarvelle', p_record => false)),
  'store_search gives the page''s pieces in its order');

-- The hints.
select tests.assert(public.store_search_hints() -> 'words' ? 'zarvelle', 'the listings'' words are suggested');
select tests.assert(public.store_search_hints() -> 'synonyms' @> '[["sari", "saree"]]'::jsonb,
  'synonym groups whose words the listings use');
select tests.assert(
  exists (select 1 from jsonb_array_elements(public.store_search_hints() -> 'regions') r
          where r ->> 'slug' = 'test-region' and (r ->> 'count')::int >= 5),
  'the states with their pieces');
select tests.assert_fails('select count(*) from public.search_words', '42501', 'visitors cannot read the vocabulary');
select tests.assert_fails('select count(*) from public.search_synonyms', '42501', 'or the synonyms');
select tests.assert_fails('select count(*) from public.product_search', '42501', 'or the search words');
select tests.assert_fails('select public.refresh_search_words()', '42501', 'or refresh them');
select tests.assert_fails('select public.admin_search_fixes()', '42501', 'or read the fixes');
reset role;

-- Recording: the first page of an unfiltered search only; a fix with its words; "some" as nothing found.
delete from public.search_queries where created_at = now();
set local role anon;
select public.store_search_page('Zarvelle  kurtis');
select public.store_search_page('zarvelle kurtis', p_offset => 24);
select public.store_search_page('zarvelle kurtis', p_type => 'clothing');
select public.store_search_page('zarvele saree');
select public.store_search_page('zarvelle qqqzzzx');
select count(*) from public.store_search('zarvelle stole');
reset role;
select tests.assert(
  (select array_agg(query || ':' || results || ':' || coalesce(fixed, '-') || ':' || partial order by id)
   from public.search_queries where created_at = now())
  = array['zarvelle kurtis:1:-:false', 'zarvele saree:1:zarvelle saree:false', 'zarvelle qqqzzzx:0:-:true',
          'zarvelle stole:2:-:false'],
  'each first unfiltered page once, with its fix, and "some of the words" as nothing found');

-- Popular searches: only searches made of the listings' words, three times or more.
insert into public.search_queries (query, results) select 'zarvelle saree', 1 from generate_series(1, 3);
insert into public.search_queries (query, results) select 'jane doe zarvelle', 1 from generate_series(1, 5);
select tests.assert(public.store_search_hints() -> 'popular' ? 'zarvelle saree', 'a search many made is suggested');
select tests.assert(not (public.store_search_hints() -> 'popular' ? 'jane doe zarvelle'),
  'never words the listings do not use (a name, an address)');

set local role authenticated;
select tests.act_as(tests.id('admin'));
select tests.assert(
  public.admin_search_fixes(now()) @> '[{"query": "zarvele saree", "fixed": "zarvelle saree", "count": 1}]'::jsonb,
  'the admin sees searches answered through a fix');
select tests.act_as(tests.id('cust_a'));
select tests.assert_fails('select public.admin_search_fixes()', 'admin_only', 'customers do not');
reset role;

-- The triggers: a renamed listing and a renamed state are found by their new names.
update public.products set name = 'Quorvane kurti' where slug = 'zv-kurti';
update public.regions set name = 'Test Haveliland' where slug = 'test-region';
set local role anon;
select tests.assert(pg_temp.names(public.store_search_page('quorvane', p_record => false)) = array['Quorvane kurti'],
  'a renamed listing is found by its new name');
select tests.assert((public.store_search_page('haveliland', p_record => false) ->> 'total')::int = 5,
  'a renamed state''s listings are found by its new name');
reset role;

rollback;

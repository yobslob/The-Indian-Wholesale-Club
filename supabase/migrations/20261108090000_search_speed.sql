-- =============================================================================
-- Search that reads as little as it can (launch QA D-1, INC-1: production's free compute ran out of disk reads, and
-- /search?q=saree answered 500 after 90 s). Measured on a production-sized copy (8,278 live listings, 26,555 options,
-- 32,000 photos; shared_buffers 16 MB so the catalogue cannot stay in memory), store_search_page() read 9,300 – 11,300
-- buffers a search (73 – 88 MB touched, 4,100 – 5,200 of them read from outside the cache when cold), even for a word
-- nothing has. Three reasons:
--  - _search_hits was a SQL function with a SET clause, so never inlined and planned once for any words: a sequential
--    scan of every listing (products' 11 MB) to join store_products, whatever the words;
--  - the old simple-word search (name, summary and description) ran beside the stemmed one on every search, reading a
--    listing's row for every description that names the word;
--  - ranking and the counts read each match's listing row (products, about 1.3 KB a row) and all its options.
-- Now:
--  - product_search carries what search filters, counts and ranks by (type, category, state, whether customers may see
--    it, coming soon, placeholder, published), kept by the trigger that already keeps its words; its GIN index covers
--    only what customers may see. Hits, counts, filters and best match read only this narrow table (4 MB).
--  - the words as typed in the description are the last resort they were meant to be: read only when the listing's
--    own words find nothing.
--  - the order needs a listing's stock (sold out last) and, for a price sort, its price: read for the best 1,000 only.
--    Counts stop at 1,000 (total 1000 with capped = true: the page says "1,000+"). At most 5,000 hits are read.
--  - a time budget (2.5 s from the start of the request's statement; iwc.search_budget_ms overrides it for tests):
--    past it, the spelling-fix and some-of-the-words passes are skipped and the answer says slow = true. A
--    function-level statement_timeout cannot do this: Postgres arms the timer when the statement starts, so a SET inside
--    the function never stops the statement already running (checked on Postgres 15). The hard stop stays the role's
--    statement timeout, and the website gives up on its side after 3.5 s (packages/db store/search.ts).
--  - every function here plans with the words it is given (plan_cache_mode = force_custom_plan), so a GIN index is
--    used whenever it pays.
--  - store_search_hints() counts categories and states from product_search too (it read every listing's row).
-- Same arguments and same jsonb as before, plus capped and slow; store_search() is unchanged.
-- Cost (D-147): database size: seven small columns on product_search (about 40 bytes a listing, 0.4 MB for 8,500), its
-- GIN index the same size or smaller (customers' listings only). Writes: the existing trigger also fires when a
-- listing's status, coming soon, placeholder or published time changes (publishing, archiving: rare); an insert by the
-- sourcing runner still writes one product_search row, as before; a price or stock change writes nothing more. CPU and
-- disk reads: see docs/data-model.md (before/after per word). No page-cache writes. Egress: none.
-- Tests: search_speed.test.sql (and search.test.sql, unchanged).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. product_search: what search filters, counts and ranks by, beside the words.
-- -----------------------------------------------------------------------------
drop index public.product_search_doc_idx;

alter table public.product_search
  add column product_type public.product_type,
  add column category_id uuid,
  add column region_id uuid,
  -- store_products' rule: live, or archived and shown as coming soon (placeholders only in dev_preview())
  add column listed boolean not null default false,
  add column soon boolean not null default false,
  add column is_placeholder boolean not null default false,
  add column published_at timestamptz;

-- Rebuilt, not updated: an update of every row would leave the table twice its size until vacuumed (the words are
-- worked out again exactly as 20261030090000_search did, about a second for 8,500 listings).
truncate public.product_search;
insert into public.product_search (product_id, doc, product_type, category_id, region_id, listed, soon, is_placeholder,
                                   published_at)
select p.id, public._product_search_doc(p.id), p.product_type, p.category_id, p.region_id,
       p.status = 'live' or (p.status = 'archived' and p.coming_soon), p.status = 'archived', p.is_placeholder,
       p.published_at
from public.products p;

alter table public.product_search
  alter column product_type set not null,
  alter column category_id set not null;

-- Only what customers may see is ever searched: the index skips drafts and archived listings.
create index product_search_listed_doc_idx on public.product_search using gin (doc) where listed;

-- A listing's options on sale (variant_availability, the stock feed kept by trigger: available = listed - reserved of
-- an active option): search's "sold out last" reads this small index, not every option's row.
create index variant_availability_on_sale_idx on public.variant_availability (product_id) where available > 0;

create or replace function public._product_search_sync() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.product_search as s (product_id, doc, product_type, category_id, region_id, listed, soon,
                                          is_placeholder, published_at)
  values (new.id, public._product_search_doc(new.id), new.product_type, new.category_id, new.region_id,
          new.status = 'live' or (new.status = 'archived' and new.coming_soon), new.status = 'archived',
          new.is_placeholder, new.published_at)
  on conflict (product_id) do update
    set doc = excluded.doc, product_type = excluded.product_type, category_id = excluded.category_id,
        region_id = excluded.region_id, listed = excluded.listed, soon = excluded.soon,
        is_placeholder = excluded.is_placeholder, published_at = excluded.published_at
    where (s.doc, s.product_type, s.category_id, s.region_id, s.listed, s.soon, s.is_placeholder, s.published_at)
          is distinct from (excluded.doc, excluded.product_type, excluded.category_id, excluded.region_id,
                            excluded.listed, excluded.soon, excluded.is_placeholder, excluded.published_at);
  return null;
end $$;
revoke all on function public._product_search_sync() from public, anon, authenticated;

create or replace trigger products_search_doc
  after insert or update of name, craft, summary, category_id, region_id, product_type, status, coming_soon,
                            is_placeholder, published_at on public.products
  for each row execute function public._product_search_sync();

-- -----------------------------------------------------------------------------
-- 2. The time budget: true once the request's statement has run longer than it (2.5 s unless iwc.search_budget_ms).
-- -----------------------------------------------------------------------------
create function public._search_late() returns boolean
language sql volatile set search_path = pg_catalog, pg_temp as $$
  select clock_timestamp() - statement_timestamp()
         > make_interval(secs => coalesce(nullif(current_setting('iwc.search_budget_ms', true), '')::numeric, 2500) / 1000)
$$;
revoke all on function public._search_late() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. The hits: listings customers may see whose own words match; only when none do (and there is time), the words as
--    typed in the name, summary or description (products.search). At most 5,000.
-- -----------------------------------------------------------------------------
create or replace function public._search_hits(p_ts tsquery, p_simple tsquery, p_quick boolean) returns table (id uuid)
language plpgsql volatile set search_path = public, pg_temp set plan_cache_mode = force_custom_plan as $$
declare
  v_quick boolean := coalesce(p_quick, false);
begin
  -- 7-day pieces asked for while 7-day delivery is off: none
  if v_quick and not exists (select 1 from public.pricing_settings s where s.id = 1
                             and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null) then
    return;
  end if;
  if p_ts is not null then
    return query
      select s.product_id from public.product_search s
      where s.listed and s.doc @@ p_ts and (not s.is_placeholder or public.dev_preview())
        and (not v_quick or (not s.soon and exists (select 1 from public._quick_listings() q where q.id = s.product_id)))
      limit 5000;
    if found then
      return;
    end if;
  end if;
  if p_simple is null or public._search_late() then
    return;
  end if;
  return query
    select s.product_id from public.products p
    join public.product_search s on s.product_id = p.id
    where p.search @@ p_simple and s.listed and (not s.is_placeholder or public.dev_preview())
      and (not v_quick or (not s.soon and exists (select 1 from public._quick_listings() q where q.id = s.product_id)))
    limit 5000;
end $$;

-- -----------------------------------------------------------------------------
-- 4. The reading of a search, as 20261030090000_search, plus slow: the budget ran out before every pass was tried.
-- -----------------------------------------------------------------------------
drop function public._search_match(text, boolean);
create function public._search_match(p_query text, p_quick boolean,
                                     out words text[], out fixed text[], out mode text, out ts tsquery,
                                     out exact tsquery, out groups tsquery[], out ids uuid[], out slow boolean)
language plpgsql volatile set search_path = public, pg_temp set plan_cache_mode = force_custom_plan as $$
declare
  v_any tsquery;
  v_g tsquery;
begin
  words := public._search_split(p_query);
  mode := 'none';
  ids := '{}';
  slow := false;
  if cardinality(words) = 0 then
    return;
  end if;
  groups := public._search_groups(words);
  if cardinality(groups) = 0 then
    return; -- only stop words ("for", "the")
  end if;
  exact := plainto_tsquery('english', array_to_string(words, ' '));
  ts := groups[1];
  foreach v_g in array groups[2:] loop
    ts := ts && v_g;
  end loop;
  select coalesce(array_agg(h.id), '{}') into ids
  from public._search_hits(ts, plainto_tsquery('simple', array_to_string(words, ' ')), p_quick) h;
  if cardinality(ids) > 0 then
    mode := 'all';
    return;
  end if;
  if public._search_late() then
    slow := true;
    return;
  end if;
  -- nothing: the words spelled as the listings spell them
  fixed := public._search_fix(words);
  if fixed is not null then
    groups := public._search_groups(fixed);
    exact := plainto_tsquery('english', array_to_string(fixed, ' '));
    if cardinality(groups) > 0 then
      ts := groups[1];
      foreach v_g in array groups[2:] loop
        ts := ts && v_g;
      end loop;
      select coalesce(array_agg(h.id), '{}') into ids
      from public._search_hits(ts, plainto_tsquery('simple', array_to_string(fixed, ' ')), p_quick) h;
    end if;
    if cardinality(ids) > 0 then
      mode := 'fixed';
      return;
    end if;
  end if;
  -- still nothing and several words: pieces with some of them, the most first
  if cardinality(groups) > 1 then
    if public._search_late() then
      slow := true;
      fixed := null;
      return;
    end if;
    v_any := groups[1];
    foreach v_g in array groups[2:] loop
      v_any := v_any || v_g;
    end loop;
    select coalesce(array_agg(h.id), '{}') into ids from public._search_hits(v_any, null, p_quick) h;
    if cardinality(ids) > 0 then
      ts := v_any;
      mode := 'some';
      return;
    end if;
  end if;
  fixed := null;
end $$;
revoke all on function public._search_hits(tsquery, tsquery, boolean), public._search_match(text, boolean)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. The search page in one read, as 20261030090000_search (same arguments and keys), reading product_search for the
--    hits, counts and best match, stock and price only for the best 1,000, and the listings' rows only for the cards.
--    Best match: what cannot be bought last, then ts_rank + 0.5 a word matched + whole words over synonyms + the words
--    in the name in order + a named state + new in 14 days.
-- -----------------------------------------------------------------------------
create or replace function public.store_search_page(p_query text, p_type text default null, p_category text default null,
                                                    p_region text default null, p_sort text default null,
                                                    p_offset integer default 0, p_limit integer default 24,
                                                    p_record boolean default true, p_quick boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp set plan_cache_mode = force_custom_plan as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_cap constant integer := 1000;
  v_m record;
  v_words text[];
  v_phrase tsquery;
  v_named text[];
  v_price boolean := p_sort in ('price-asc', 'price-desc');
  v_result jsonb;
  v_total integer;
begin
  select * into v_m from public._search_match(v_query, coalesce(p_quick, false));
  v_words := coalesce(v_m.fixed, v_m.words);
  -- several words, in order, in the listing's name ("block print kurti")
  if cardinality(v_words) > 1 then
    v_phrase := phraseto_tsquery('english', array_to_string(v_words, ' '));
    if numnode(v_phrase) = 0 then
      v_phrase := null;
    end if;
  end if;
  -- the states the words name ("kerala", "punjabi"): their pieces first, and offered as a filter
  select coalesce(array_agg(r.slug order by r.name), '{}') into v_named
  from public.regions r
  where v_m.mode <> 'none'
    and exists (select 1 from unnest(v_m.groups) g where to_tsvector('english', r.name) @@ g);

  with m as materialized (
    select s.product_id as id, s.product_type::text as product_type, r.slug as region_slug, r.name as region_name,
           c.slug as category_slug, c.name as category_name, s.published_at, s.soon,
           ts_rank(s.doc, v_m.ts)
             + 0.5 * (select count(*) from unnest(v_m.groups) g where s.doc @@ g)
             + case when s.doc @@ v_m.exact then 0.3 else 0 end
             + case when ts_filter(s.doc, '{a}') @@ v_phrase then 0.5 else 0 end
             + case when r.slug = any (v_named) then 0.2 else 0 end
             + case when s.published_at > now() - interval '14 days' then 0.05 else 0 end as score
    from public.product_search s
    join public.categories c on c.id = s.category_id
    left join public.regions r on r.id = s.region_id
    where s.product_id = any (v_m.ids)),
  f as (
    select m.*,
           (p_type is null or m.product_type = p_type) as t_ok,
           (p_category is null or m.category_slug = p_category) as c_ok,
           (p_region is null or m.region_slug = p_region or m.region_slug is null) as r_ok
    from m),
  shown as (select * from f where t_ok and c_ok and r_ok),
  -- the best 1,000 by the order below without stock (a price sort reads each match's price), then their stock
  cand as materialized (
    select shown.id, shown.soon, shown.score, shown.published_at, x.price_cents
    from shown
    left join lateral (select p.price_cents from public.products p where v_price and p.id = shown.id) x on true
    order by shown.soon,
             case when p_sort = 'price-asc' then x.price_cents end,
             case when p_sort = 'price-desc' then x.price_cents end desc,
             case when p_sort = 'new' then shown.published_at end desc nulls last,
             shown.score desc, shown.published_at desc nulls last, shown.id
    limit v_cap),
  ranked as (
    select cand.*,
           cand.soon or not exists (select 1 from public.variant_availability a
                                    where a.product_id = cand.id and a.available > 0) as last
    from cand)
  select jsonb_build_object(
    'query', v_query,
    'fixed', array_to_string(v_m.fixed, ' '),
    'mode', v_m.mode,
    'total', (select count(*) from (select 1 from shown limit v_cap) x),
    'all_total', (select count(*) from (select 1 from m limit v_cap) x),
    'capped', (select count(*) > v_cap from (select 1 from shown limit v_cap + 1) x),
    'slow', v_m.slow,
    'types', coalesce((select jsonb_object_agg(product_type, n) from (
                         select product_type, count(*) as n from f where r_ok group by product_type) t), '{}'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', category_slug, 'name', category_name, 'type', product_type, 'count', n)
                       order by n desc, category_name)
      from (select category_slug, category_name, product_type, count(*) as n from f where t_ok and r_ok
            group by category_slug, category_name, product_type order by count(*) desc, category_name limit 12) c),
      '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', region_slug, 'name', region_name, 'count', n) order by n desc, region_name)
      from (select region_slug, region_name, count(*) as n from f where t_ok and c_ok and region_slug is not null
            group by region_slug, region_name order by count(*) desc, region_name limit 12) r),
      '[]'::jsonb),
    'named_regions', to_jsonb(v_named),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'slug', p.slug, 'name', p.name, 'product_type', p.product_type,
               'region_slug', p.region_slug, 'region_name', p.region_name,
               'category_slug', p.category_slug, 'category_name', p.category_name,
               'price_cents', p.price_cents, 'primary_image_path', p.primary_image_path,
               'pack', public._store_pack(p.id, p.name, p.product_type),
               'coming_soon', p.coming_soon,
               'options', case when not p.coming_soon then public._store_card_options(p.id) end,
               'quick_days', case when not p.coming_soon then public._quick_days(p.id) end)
             order by k.k)
      from (select ranked.id, row_number() over (order by
                     -- what cannot be bought last, whatever the order
                     ranked.last,
                     case when p_sort = 'price-asc' then ranked.price_cents end,
                     case when p_sort = 'price-desc' then ranked.price_cents end desc,
                     case when p_sort = 'new' then ranked.published_at end desc nulls last,
                     ranked.score desc, ranked.published_at desc nulls last, ranked.id) as k
            from ranked
            order by k
            offset greatest(coalesce(p_offset, 0), 0)
            limit least(greatest(coalesce(p_limit, 24), 1), 500)) k
      join public.store_products p on p.id = k.id), '[]'::jsonb))
  into v_result;

  if coalesce(p_record, true) and coalesce(p_offset, 0) = 0 and v_query <> ''
     and p_type is null and p_category is null and p_region is null and p_sort is null then
    v_total := case when v_m.mode = 'some' then 0 else cardinality(v_m.ids) end;
    insert into public.search_queries (query, results, fixed, partial)
    values (lower(v_query), v_total, case when v_m.mode = 'fixed' then array_to_string(v_m.fixed, ' ') end,
            v_m.mode = 'some');
  end if;
  return v_result;
end $$;

revoke all on function public.store_search_page(text, text, text, text, text, integer, integer, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.store_search_page(text, text, text, text, text, integer, integer, boolean, boolean)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. The suggestions' list, as 20261030090000_search, counting categories and states from product_search.
-- -----------------------------------------------------------------------------
create or replace function public.store_search_hints() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select s.product_type::text as product_type, c.slug as category_slug, c.name as category_name, r.slug as region_slug
    from public.product_search s
    join public.categories c on c.id = s.category_id
    left join public.regions r on r.id = s.region_id
    where s.listed and not s.soon and (not s.is_placeholder or public.dev_preview()))
  select jsonb_build_object(
    'words', coalesce((select jsonb_agg(w.word order by w.ndoc desc, w.word)
                       from (select word, ndoc from public.search_words order by ndoc desc, word limit 1500) w),
                      '[]'::jsonb),
    'synonyms', coalesce((
      select jsonb_agg(g.terms order by g.grp)
      from (select s.grp, jsonb_agg(s.term order by s.term) as terms from public.search_synonyms s
            where exists (select 1 from public.search_synonyms t join public.search_words w on w.word_key = t.term_key
                          where t.grp = s.grp)
            group by s.grp) g), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('type', c.product_type, 'slug', c.category_slug, 'name', c.category_name,
                                          'count', c.n) order by c.n desc)
      from (select product_type, category_slug, category_name, count(*) as n from live
            group by product_type, category_slug, category_name) c), '[]'::jsonb),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('slug', r.slug, 'name', r.name, 'count', coalesce(n.n, 0)) order by r.name)
      from public.regions r
      left join (select region_slug, count(*) as n from live where region_slug is not null group by region_slug) n
        on n.region_slug = r.slug), '[]'::jsonb),
    'popular', coalesce((
      select jsonb_agg(q.query order by q.n desc, q.query)
      from (select sq.query, count(*) as n from public.search_queries sq
            where sq.created_at > now() - interval '30 days' and sq.results > 0 and not sq.partial and sq.fixed is null
              and sq.query ~ '^[a-z ]{3,40}$'
              and not exists (select 1 from regexp_split_to_table(sq.query, ' ') x(word)
                              where length(x.word) >= 2
                                and not exists (select 1 from public.search_words w
                                                where w.word_key = public._search_key(x.word)))
            group by sq.query having count(*) >= 3
            order by count(*) desc, sq.query limit 12) q), '[]'::jsonb))
$$;
revoke all on function public.store_search_hints() from public, anon, authenticated;
grant execute on function public.store_search_hints() to anon, authenticated, service_role;

analyze public.product_search;
analyze public.variant_availability;

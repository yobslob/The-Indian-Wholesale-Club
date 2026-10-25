-- =============================================================================
-- Search that understands customers (D-160), at no running cost: Postgres full-text search with English stems,
-- a synonym list and a vocabulary of the listings' own words, all inside the database's free tier.
--  - product_search: each listing's search words (name, category, craft, state, summary, type) with English stems
--    ("kurtis" finds "kurti", "sarees" finds "saree"), kept by triggers. The old products.search (simple words with
--    the description) stays for the admin's searches and as search's last resort.
--  - search_synonyms: words that mean the same to a customer (haldi = turmeric, sari = saree, punjabi = Punjab).
--    Claude's draft (D-160), checked by the founder; one row per word, a group per meaning.
--  - search_words: the vocabulary of live listings' names (refreshed every 6 hours by pg_cron), for spelling fixes
--    ("kurtha" → "kurta") and the suggestions while typing.
--  - store_search_page(...): one round trip: the matches ranked (whole words before synonyms, in stock before sold
--    out, newer first among equals), the counts per type, category and state, the page of cards, and how the words
--    were read ("Showing results for", "some of your words").
--  - store_search(...) keeps its arguments and rows (the app already on phones calls it) and finds what the page does.
--  - store_search_hints(): the words, categories, states and popular searches the browser and the app suggest from,
--    read once and kept by the CDN (no database call per keystroke).
-- Cost (D-147): database size: product_search 4 MB with its index for 7,500 listings (measured on a scaled local
-- catalogue; production's longer names perhaps twice that), the vocabulary and synonyms under 1 MB; search_queries
-- gains two small columns. CPU: 6 – 40 ms a search on 7,200 live listings. No page-cache writes. Egress: the hints
-- (about 8 KB of JSON for that catalogue; at most 1,500 words) once an hour per CDN region.
-- Tests: search.test.sql.
-- =============================================================================

create extension if not exists fuzzystrmatch with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. A word's search key: its English stems, sorted ("Kurtis" and "kurti" share one). Immutable, so it can be stored.
-- -----------------------------------------------------------------------------
create function public._search_key(p_text text) returns text
language sql immutable parallel safe set search_path = pg_catalog, pg_temp as $$
  select string_agg(lexeme, ' ' order by lexeme) from unnest(to_tsvector('english'::regconfig, coalesce(p_text, '')))
$$;

-- The words of a search: lower case, letters and digits only, two characters or more, at most 8 of up to 30.
create function public._search_split(p_query text) returns text[]
language sql immutable parallel safe set search_path = pg_catalog, pg_temp as $$
  select coalesce(array_agg(w order by n), '{}')
  from (select left(t.w, 30) as w, t.n
        from regexp_split_to_table(lower(coalesce(p_query, '')), '[^[:alnum:]]+') with ordinality t(w, n)
        where length(t.w) >= 2
        order by t.n
        limit 8) x
$$;

-- -----------------------------------------------------------------------------
-- 2. product_search: what a listing is found by. Name first (A); its category, craft and state (B); its summary (C);
--    its type (D: "food" finds food). Admin-only table, read through the store_* functions below.
-- -----------------------------------------------------------------------------
create table public.product_search (
  product_id uuid primary key references public.products (id) on delete cascade,
  doc tsvector not null
);
create index product_search_doc_idx on public.product_search using gin (doc);
alter table public.product_search enable row level security;
revoke all on public.product_search from anon, authenticated;

create function public._product_search_doc(p_product uuid) returns tsvector
language sql stable set search_path = public, pg_temp as $$
  select setweight(to_tsvector('english', coalesce(p.name, '')), 'A')
      || setweight(to_tsvector('english', c.name || ' ' || coalesce(p.craft, '') || ' ' || coalesce(r.name, '')), 'B')
      || setweight(to_tsvector('english', coalesce(p.summary, '')), 'C')
      || setweight(to_tsvector('english', case p.product_type::text when 'home' then 'home gifts' else p.product_type::text end), 'D')
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.regions r on r.id = p.region_id
  where p.id = p_product
$$;
revoke all on function public._product_search_doc(uuid) from public, anon, authenticated;

-- Definer: an admin's edit (RLS on products) also writes the listing's search words, which no customer role may.
create function public._product_search_sync() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.product_search (product_id, doc) values (new.id, public._product_search_doc(new.id))
  on conflict (product_id) do update set doc = excluded.doc where product_search.doc is distinct from excluded.doc;
  return null;
end $$;
revoke all on function public._product_search_sync() from public, anon, authenticated;

create trigger products_search_doc
  after insert or update of name, craft, summary, category_id, region_id, product_type on public.products
  for each row execute function public._product_search_sync();

-- A state or category renamed (rare): its listings' words follow.
create function public._product_search_renamed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.product_search s set doc = public._product_search_doc(s.product_id)
  from public.products p
  where p.id = s.product_id
    and ((tg_table_name = 'regions' and p.region_id = new.id) or (tg_table_name = 'categories' and p.category_id = new.id));
  return null;
end $$;
revoke all on function public._product_search_renamed() from public, anon, authenticated;

create trigger regions_search_doc after update of name on public.regions
  for each row when (old.name is distinct from new.name) execute function public._product_search_renamed();
create trigger categories_search_doc after update of name on public.categories
  for each row when (old.name is distinct from new.name) execute function public._product_search_renamed();

insert into public.product_search (product_id, doc)
select p.id, public._product_search_doc(p.id) from public.products p;

-- -----------------------------------------------------------------------------
-- 3. search_synonyms: one row per word or short phrase; the words of a group mean the same to a customer. Matched by
--    their stems, so "saris" finds the group of "sari". Claude's draft (D-160): spellings and Hindi/English names of the
--    same thing, and the people of a state for the state ("punjabi" → Punjab). Never shown as such to customers.
-- -----------------------------------------------------------------------------
create table public.search_synonyms (
  term text primary key check (term = lower(btrim(term)) and term <> ''),
  grp text not null,
  term_key text generated always as (public._search_key(term)) stored
);
create index search_synonyms_key_idx on public.search_synonyms (term_key);
create index search_synonyms_grp_idx on public.search_synonyms (grp);
alter table public.search_synonyms enable row level security;
create policy admin_read on public.search_synonyms for select to authenticated using (public.is_admin());
revoke all on public.search_synonyms from anon, authenticated;
grant select on public.search_synonyms to authenticated;

insert into public.search_synonyms (term, grp)
select t, g[1]
from (values
  -- clothing
  (array['saree', 'sari']),
  (array['salwar', 'shalwar', 'salvar']),
  (array['churidar', 'churidaar']),
  (array['lehenga', 'lehnga', 'lengha', 'lahenga', 'lehanga', 'ghagra', 'ghaghra']),
  (array['dupatta', 'chunni', 'chunri', 'chunari', 'odhni']),
  (array['pyjama', 'pajama', 'payjama']),
  (array['jutti', 'juti', 'jooti', 'mojari', 'mojri', 'nagra']),
  (array['chappal', 'chapal']),
  (array['kolhapuri', 'kolapuri']),
  (array['jhumka', 'jhumki', 'jumka']),
  (array['bangle', 'chudi', 'choodi', 'kangan']),
  (array['dhoti', 'veshti', 'vesti', 'mundu']),
  (array['lungi', 'kaili']),
  (array['turban', 'pagri', 'pagdi', 'safa']),
  (array['tshirt', 'tee', 'tees']),
  (array['pashmina', 'pashmeena']),
  (array['chikankari', 'chikan', 'chikenkari']),
  (array['bandhani', 'bandhej', 'bandini']),
  (array['kanjeevaram', 'kanjivaram', 'kanchipuram', 'kancheepuram']),
  (array['banarasi', 'benarasi', 'banaras', 'varanasi']),
  (array['ikat', 'ikkat']),
  (array['leheriya', 'lehariya', 'leheria']),
  -- food
  (array['turmeric', 'haldi']),
  (array['cumin', 'jeera', 'zeera']),
  (array['cardamom', 'elaichi', 'ilaichi']),
  (array['coriander', 'dhania', 'dhaniya']),
  (array['chilli', 'chili', 'mirchi', 'mirch']),
  (array['asafoetida', 'asafetida', 'hing', 'heeng']),
  (array['fenugreek', 'methi']),
  (array['carom', 'ajwain', 'ajowan']),
  (array['fennel', 'saunf', 'sounf']),
  (array['mustard', 'sarson', 'rai']),
  (array['nigella', 'kalonji']),
  (array['cinnamon', 'dalchini']),
  (array['clove', 'laung', 'lavang']),
  (array['black pepper', 'kali mirch']),
  (array['saffron', 'kesar']),
  (array['tamarind', 'imli']),
  (array['amchur', 'amchoor', 'mango powder']),
  (array['jaggery', 'gur', 'gud']),
  (array['atta', 'wheat flour']),
  (array['besan', 'gram flour', 'chickpea flour']),
  (array['maida', 'refined flour']),
  (array['semolina', 'sooji', 'suji', 'rava', 'rawa']),
  (array['poha', 'flattened rice', 'aval']),
  (array['dal', 'daal', 'dhal', 'lentil']),
  (array['chickpea', 'chana', 'channa', 'chole', 'chhole']),
  (array['rajma', 'kidney bean']),
  (array['moong', 'mung']),
  (array['toor', 'tuvar', 'arhar']),
  (array['ghee', 'clarified butter']),
  (array['pickle', 'achar', 'achaar']),
  (array['papad', 'papadum', 'poppadom', 'appalam', 'pappadam']),
  (array['sweets', 'mithai']),
  (array['ladoo', 'laddu', 'laddoo', 'ladu']),
  (array['barfi', 'burfi']),
  (array['halwa', 'halva']),
  (array['jalebi', 'jilebi']),
  (array['rasgulla', 'rasagola', 'rosogolla']),
  (array['tea', 'chai']),
  (array['coffee', 'kaapi']),
  (array['makhana', 'fox nut', 'foxnut', 'lotus seed']),
  (array['bhujia', 'bujia']),
  (array['murukku', 'chakli', 'chakri']),
  (array['khakhra', 'khakra']),
  (array['sharbat', 'sherbet', 'sharbet']),
  (array['ragi', 'nachni', 'finger millet']),
  (array['sago', 'sabudana']),
  (array['sambar', 'sambhar']),
  (array['chutney', 'chatni']),
  (array['curry leaves', 'kadi patta', 'kari patta']),
  -- home & gifts
  (array['incense', 'agarbatti']),
  (array['diya', 'deepam']),
  (array['pooja', 'puja']),
  (array['thali', 'thaali']),
  (array['kadai', 'kadhai', 'karahi']),
  (array['tawa', 'tava']),
  (array['idol', 'murti', 'moorti']),
  (array['ganesha', 'ganesh', 'ganpati', 'ganapati', 'vinayaka']),
  (array['lakshmi', 'laxmi']),
  (array['shiva', 'shiv']),
  (array['brass', 'pital']),
  (array['dhurrie', 'durrie', 'dhurri']),
  (array['toran', 'bandhanwar']),
  (array['tiffin', 'dabba', 'lunch box']),
  -- the people and other names of a state
  (array['punjab', 'punjabi']),
  (array['bengal', 'bengali', 'bangla']),
  (array['gujarat', 'gujarati']),
  (array['rajasthan', 'rajasthani']),
  (array['maharashtra', 'marathi', 'maharashtrian']),
  (array['tamil', 'tamilnadu']),
  (array['kashmir', 'kashmiri']),
  (array['odisha', 'orissa', 'odia', 'oriya']),
  (array['puducherry', 'pondicherry', 'pondy']),
  (array['kerala', 'keralan', 'malayali']),
  (array['goa', 'goan']),
  (array['assam', 'assamese']),
  (array['bihar', 'bihari']),
  (array['himachal', 'himachali']),
  (array['karnataka', 'kannada', 'kannadiga']),
  (array['manipur', 'manipuri']),
  (array['nagaland', 'naga']),
  (array['mizoram', 'mizo'])
) v(g), unnest(v.g) t
on conflict (term) do nothing;

-- -----------------------------------------------------------------------------
-- 4. search_words: the words of live listings' names, categories, crafts and states, with how many listings use
--    them (the spelling fixes and the suggestions), one spelling per stem ("kurta", not also "kurtas"),
--    no stop words, plus each one-word synonym whose group is in the listings.
-- -----------------------------------------------------------------------------
create table public.search_words (
  word text primary key,
  word_key text generated always as (public._search_key(word)) stored,
  ndoc integer not null check (ndoc > 0)
);
create index search_words_key_idx on public.search_words (word_key);
alter table public.search_words enable row level security;
create policy admin_read on public.search_words for select to authenticated using (public.is_admin());
revoke all on public.search_words from anon, authenticated;
grant select on public.search_words to authenticated;

-- Writes only what changed (a few rows on a usual day). Run by pg_cron every 6 hours and once below.
create function public.refresh_search_words() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_changed integer;
begin
  with listed as (
    select word, ndoc from ts_stat($q$
      select to_tsvector('simple', p.name || ' ' || p.category_name || ' ' || coalesce(p.craft, '') || ' '
                                   || coalesce(p.region_name, ''))
      from public.store_products p where not p.coming_soon $q$)
    where word ~ '^[a-z]{3,24}$'),
  keyed as materialized (select word, ndoc, public._search_key(word) as k from listed),
  -- one spelling per stem, the shortest (mostly the singular: "saree", not "sarees" from "Sarees & Drapes"), counted
  -- as its most used spelling; stop words have no stem and are left out
  spelt as (
    select distinct on (k) word, max(ndoc) over (partition by k) as ndoc
    from keyed where k is not null order by k, length(word), ndoc desc, word),
  -- a synonym counts as often as the most-used word of its group (a group the listings never use is left out)
  synonyms as (
    select s.term as word, max(l.ndoc)::integer as ndoc
    from public.search_synonyms s
    join public.search_synonyms g on g.grp = s.grp
    join keyed l on l.k = g.term_key
    where s.term ~ '^[a-z]{3,24}$'
      and not exists (select 1 from spelt x where public._search_key(x.word) = s.term_key)
    group by s.term),
  fresh as (
    select word, max(ndoc)::integer as ndoc from (select * from spelt union all select * from synonyms) a group by word),
  gone as (delete from public.search_words w where not exists (select 1 from fresh f where f.word = w.word) returning 1),
  put as (
    insert into public.search_words (word, ndoc) select word, ndoc from fresh
    on conflict (word) do update set ndoc = excluded.ndoc where search_words.ndoc <> excluded.ndoc
    returning 1)
  select (select count(*) from gone) + (select count(*) from put) into v_changed;
  return v_changed;
end $$;
revoke all on function public.refresh_search_words() from public, anon, authenticated;
grant execute on function public.refresh_search_words() to service_role;

select public.refresh_search_words();

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule('iwc-search-words', '17 */6 * * *', 'select public.refresh_search_words()');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Reading the words: one tsquery per word (with its synonyms; a last word that is no whole word of the listings
--    also as a beginning: "kanjeev"), a pair of words that is a synonym ("gram flour") counted as one.
-- -----------------------------------------------------------------------------
create function public._search_term(p_words text, p_prefix boolean) returns tsquery
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_key text := public._search_key(p_words);
  v_q tsquery;
  v_alt text;
begin
  if v_key is null then
    return null; -- only stop words ("for", "with")
  end if;
  v_q := phraseto_tsquery('english', p_words);
  for v_alt in
    select distinct s2.term from public.search_synonyms s1
    join public.search_synonyms s2 on s2.grp = s1.grp
    where s1.term_key = v_key and s2.term_key is distinct from v_key
  loop
    v_q := v_q || phraseto_tsquery('english', v_alt);
  end loop;
  if p_prefix and p_words ~ '^[[:alnum:]]{3,}$'
     and not exists (select 1 from public.search_words w where w.word_key = v_key)
     and not exists (select 1 from public.search_synonyms s where s.term_key = v_key) then
    v_q := v_q || to_tsquery('english', p_words || ':*');
  end if;
  return v_q;
end $$;

create function public._search_groups(p_words text[]) returns tsquery[]
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_groups tsquery[] := '{}';
  v_n integer := coalesce(cardinality(p_words), 0);
  v_i integer := 1;
  v_q tsquery;
begin
  while v_i <= v_n loop
    if v_i < v_n and exists (select 1 from public.search_synonyms s
                             where s.term_key = public._search_key(p_words[v_i] || ' ' || p_words[v_i + 1])
                               and s.term like '% %') then
      v_q := public._search_term(p_words[v_i] || ' ' || p_words[v_i + 1], false);
      v_i := v_i + 2;
    else
      v_q := public._search_term(p_words[v_i], v_i = v_n);
      v_i := v_i + 1;
    end if;
    if v_q is not null and numnode(v_q) > 0 then
      v_groups := v_groups || v_q;
    end if;
  end loop;
  return v_groups;
end $$;

-- A word no listing uses, spelled as the nearest one that is ("kurtha" → "kurta", "dupata" → "dupatta"): one change
-- for words up to five letters (or two swapped letters: "kutra" → "kurta"), two for longer ones; null when no word
-- needed fixing.
-- A word's letters in order ("kutra" and "kurta" have the same): two changes that only swap letters.
create function public._search_letters(p_word text) returns text
language sql immutable parallel safe set search_path = pg_catalog, pg_temp as $$
  select string_agg(c, '' order by c) from regexp_split_to_table(p_word, '') c
$$;

create function public._search_fix(p_words text[]) returns text[]
language plpgsql stable set search_path = public, extensions, pg_temp as $$
declare
  v_out text[] := '{}';
  v_word text;
  v_best text;
  v_changed boolean := false;
begin
  foreach v_word in array coalesce(p_words, '{}') loop
    v_best := null;
    if v_word ~ '^[a-z]{4,}$'
       and not exists (select 1 from public.search_words w where w.word_key = public._search_key(v_word))
       and not exists (select 1 from public.search_synonyms s where s.term_key = public._search_key(v_word)) then
      select w.word into v_best
      from public.search_words w
      where abs(length(w.word) - length(v_word)) <= 2
        and (levenshtein_less_equal(w.word, v_word, 1) <= 1
             or (levenshtein_less_equal(w.word, v_word, 2) <= 2
                 and (length(v_word) >= 6 or public._search_letters(w.word) = public._search_letters(v_word))))
      order by levenshtein(w.word, v_word), (left(w.word, 1) = left(v_word, 1)) desc, w.ndoc desc, w.word
      limit 1;
    end if;
    v_out := v_out || coalesce(v_best, v_word);
    v_changed := v_changed or v_best is not null;
  end loop;
  return case when v_changed then v_out end;
end $$;

-- What matches, as customers may see it: listings whose search words have every group (p_any: any group), or whose
-- name, summary or description have every word as typed (the old search, kept as the last resort).
create function public._search_hits(p_ts tsquery, p_simple tsquery, p_quick boolean) returns table (id uuid)
language sql stable set search_path = public, pg_temp as $$
  with quick as materialized (
    select q.id from public._quick_listings() q
    where p_quick and exists (select 1 from public.pricing_settings s where s.id = 1
                              and s.quick_delivery_days_min is not null and s.quick_delivery_days_max is not null)),
  h as (
    select s.product_id as id from public.product_search s where s.doc @@ p_ts
    union
    select p.id from public.products p where p_simple is not null and p.search @@ p_simple)
  select h.id from h
  join public.store_products sp on sp.id = h.id
  where not p_quick or (not sp.coming_soon and h.id in (select q.id from quick q))
$$;

-- The whole reading of a search: its words, the fixed words when the search needed a fix, how it matched ('all', 'fixed',
-- 'some' or 'none'), the tsquery that matched, the words as typed (ranking: whole words before synonyms), every group
-- (ranking: how many matched) and the matching listings.
create function public._search_match(p_query text, p_quick boolean,
                                     out words text[], out fixed text[], out mode text, out ts tsquery,
                                     out exact tsquery, out groups tsquery[], out ids uuid[])
language plpgsql stable set search_path = public, pg_temp as $$
declare
  v_simple tsquery;
  v_any tsquery;
  v_g tsquery;
begin
  words := public._search_split(p_query);
  mode := 'none';
  ids := '{}';
  if cardinality(words) = 0 then
    return;
  end if;
  groups := public._search_groups(words);
  if cardinality(groups) = 0 then
    return; -- only stop words ("for", "the")
  end if;
  exact := plainto_tsquery('english', array_to_string(words, ' '));
  v_simple := plainto_tsquery('simple', array_to_string(words, ' '));
  if cardinality(groups) > 0 then
    ts := groups[1];
    foreach v_g in array groups[2:] loop
      ts := ts && v_g;
    end loop;
    select coalesce(array_agg(h.id), '{}') into ids from public._search_hits(ts, v_simple, p_quick) h;
  end if;
  if cardinality(ids) > 0 then
    mode := 'all';
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

revoke all on function public._search_split(text), public._search_key(text), public._search_term(text, boolean),
  public._search_groups(text[]), public._search_letters(text), public._search_fix(text[]), public._search_hits(tsquery, tsquery, boolean),
  public._search_match(text, boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. What customers searched: the words a search was answered with when it needed a fix, and whether it found only
--    pieces with some of the words. Still no user and no address.
-- -----------------------------------------------------------------------------
alter table public.search_queries
  add column fixed text check (length(fixed) <= 100),
  add column partial boolean not null default false;

-- -----------------------------------------------------------------------------
-- 7. The search page in one read (D-160).
--    p_type / p_category / p_region narrow the matches (a state keeps its all-India pieces after its own, as See all);
--    p_sort: null (best match), 'price-asc', 'price-desc', 'new'. Only the first page of an unfiltered search is
--    recorded, and a search answered only by some of its words counts as finding nothing (what to list next).
-- -----------------------------------------------------------------------------
create function public.store_search_page(p_query text, p_type text default null, p_category text default null,
                                         p_region text default null, p_sort text default null,
                                         p_offset integer default 0, p_limit integer default 24,
                                         p_record boolean default true, p_quick boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_query text := left(btrim(regexp_replace(coalesce(p_query, ''), '\s+', ' ', 'g')), 100);
  v_m record;
  v_phrase text;
  v_named text[];
  v_result jsonb;
  v_total integer;
begin
  select * into v_m from public._search_match(v_query, coalesce(p_quick, false));
  v_phrase := array_to_string(coalesce(v_m.fixed, v_m.words), ' ');
  -- the states the words name ("kerala", "punjabi"): their pieces first, and offered as a filter
  select coalesce(array_agg(r.slug order by r.name), '{}') into v_named
  from public.regions r
  where v_m.mode <> 'none'
    and exists (select 1 from unnest(v_m.groups) g where to_tsvector('english', r.name) @@ g);

  with m as materialized (
    select p.id, p.product_type::text as product_type, p.region_slug, p.region_name, p.category_slug, p.category_name,
           p.price_cents, p.published_at, p.coming_soon,
           (s.doc @@ v_m.ts) as doc_hit,
           not exists (select 1 from public.product_variants v
                       where v.product_id = p.id and v.is_active and v.qty_listed > v.qty_reserved) as sold_out,
           ts_rank(s.doc, v_m.ts)
             + 0.5 * (select count(*) from unnest(v_m.groups) g where s.doc @@ g)
             + case when s.doc @@ v_m.exact then 0.3 else 0 end
             -- several words in the name as typed, in order ("block print kurti")
             + case when v_phrase like '% %' and lower(p.name) like '%' || v_phrase || '%' then 0.5 else 0 end
             + case when p.region_slug = any (v_named) then 0.2 else 0 end
             + case when p.published_at > now() - interval '14 days' then 0.05 else 0 end as score
    from public.store_products p
    join public.product_search s on s.product_id = p.id
    where p.id = any (v_m.ids)),
  f as (
    select m.*,
           (p_type is null or m.product_type = p_type) as t_ok,
           (p_category is null or m.category_slug = p_category) as c_ok,
           (p_region is null or m.region_slug = p_region or m.region_slug is null) as r_ok
    from m),
  shown as (select * from f where t_ok and c_ok and r_ok)
  select jsonb_build_object(
    'query', v_query,
    'fixed', array_to_string(v_m.fixed, ' '),
    'mode', v_m.mode,
    'total', (select count(*) from shown),
    'all_total', (select count(*) from m),
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
      from (select shown.id, row_number() over (order by
                     -- what cannot be bought last, whatever the order
                     shown.coming_soon or shown.sold_out,
                     case when p_sort = 'price-asc' then shown.price_cents end,
                     case when p_sort = 'price-desc' then shown.price_cents end desc,
                     case when p_sort = 'new' then shown.published_at end desc nulls last,
                     -- best match: the listing's own words before its description, then the score
                     shown.doc_hit desc, shown.score desc,
                     shown.published_at desc nulls last, shown.id) as k
            from shown
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
-- 8. The old search (the app already on phones): same arguments and rows, the new reading and order.
-- -----------------------------------------------------------------------------
create or replace function public.store_search(p_query text, p_offset integer default 0, p_limit integer default 24,
                                               p_record boolean default true, p_quick boolean default false)
returns setof public.store_products
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_page jsonb := public.store_search_page(p_query, null, null, null, null, p_offset, p_limit, p_record, p_quick);
begin
  return query
    select p.* from jsonb_array_elements(v_page -> 'products') with ordinality e(card, n)
    join public.store_products p on p.id = (e.card ->> 'id')::uuid
    order by e.n;
end $$;

-- -----------------------------------------------------------------------------
-- 9. What the search boxes suggest while typing, read once and kept by the CDN (/api/search/hints): the 1,500 most
--    used words, the synonym groups in use, the categories and states with pieces, and searches many customers made
--    that found pieces (only ones made of the listings' own words: nobody's name or address is ever suggested).
-- -----------------------------------------------------------------------------
create function public.store_search_hints() returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select p.product_type::text as product_type, p.category_slug, p.category_name, p.region_slug
    from public.store_products p where not p.coming_soon)
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

-- -----------------------------------------------------------------------------
-- 10. Insights: the searches answered only through a spelling fix, with the words they were answered with (a synonym
--     or a word to add), and adding one as a synonym. Searches that found only some of their words are recorded with
--     0 results, so they already show among admin_demand()'s empty searches.
-- -----------------------------------------------------------------------------
create function public.admin_search_fixes(p_since timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'query', t.query, 'fixed', t.fixed, 'count', t.n,
             -- the words that changed, each with whether it is a synonym by now: [typed, read as, added]
             'pairs', (select coalesce(jsonb_agg(jsonb_build_array(a.w, b.w,
                                                   exists (select 1 from public.search_synonyms s where s.term = a.w))
                                                 order by a.n), '[]'::jsonb)
                       from unnest(public._search_split(t.query)) with ordinality a(w, n)
                       join unnest(string_to_array(t.fixed, ' ')) with ordinality b(w, n) on b.n = a.n
                       where a.w <> b.w))
           order by t.n desc, t.query)
    from (select query, fixed, count(*) as n from public.search_queries
          where fixed is not null and (p_since is null or created_at >= p_since)
          group by query, fixed order by count(*) desc, query limit 20) t), '[]'::jsonb);
end $$;
revoke all on function public.admin_search_fixes(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_search_fixes(timestamptz) to authenticated, service_role;

-- Insights' "Add as a synonym": the customer's word joins the group of the word it was read as (a new group when that
-- word has none), and the vocabulary is refreshed so the suggestions know it at once.
create function public.admin_add_synonym(p_term text, p_means text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_grp text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if coalesce(p_term, '') !~ '^[a-z]{2,30}$' or coalesce(p_means, '') !~ '^[a-z]{2,30}$' or p_term = p_means then
    raise exception 'bad_synonym' using errcode = '22023';
  end if;
  select grp into v_grp from public.search_synonyms where term = p_means;
  if v_grp is null then
    v_grp := p_means;
    insert into public.search_synonyms (term, grp) values (p_means, v_grp);
  end if;
  insert into public.search_synonyms (term, grp) values (p_term, v_grp)
  on conflict (term) do update set grp = excluded.grp;
  perform public.refresh_search_words();
end $$;
revoke all on function public.admin_add_synonym(text, text) from public, anon, authenticated;
grant execute on function public.admin_add_synonym(text, text) to authenticated, service_role;

-- D-160: search's vocabulary from the seeded listings (migrations run before the seed, so the migration's own refresh
-- found none). Production refreshes it every 6 hours (pg_cron iwc-search-words).
select public.refresh_search_words();

-- D-197: the rates the store shows prices abroad at, from Settings, readable by anyone through store_policy().
begin;
select tests.setup();
set local role anon;
select tests.assert(
  (select (p -> 'fx' ->> 'ca')::numeric = 1.4130 and (p -> 'fx' ->> 'au')::numeric = 1.4570
          and (p -> 'fx' ->> 'nz')::numeric = 1.8060
   from public.store_policy() p),
  'the seeded rates reach the store');
reset role;
update public.pricing_settings set fx_usd_nzd = null where id = 1;
set local role anon;
select tests.assert(
  (select p -> 'fx' -> 'nz' = 'null'::jsonb and (p -> 'fx' ->> 'ca')::numeric = 1.4130 from public.store_policy() p),
  'an empty rate reads null (that country sees US dollars)');
reset role;
rollback;

-- store_policy's standard days (D-161): the pilot's days from Settings for the browser's "at your door by" lines.
begin;
select tests.setup();
update public.pricing_settings set pilot_delivery_days_min = 12, pilot_delivery_days_max = 16 where id = 1;
set local role anon;
select tests.assert(
  (select (p ->> 'delivery_days_min')::int = 12 and (p ->> 'delivery_days_max')::int = 16 from public.store_policy() p),
  'anyone reads the standard days the pages count from');
reset role;
update public.pricing_settings set pilot_delivery_days_min = null, pilot_delivery_days_max = null where id = 1;
select tests.assert(
  (select p -> 'delivery_days_min' = 'null'::jsonb from public.store_policy() p),
  'in cycle mode there are none (the window comes from the cycle)');
rollback;

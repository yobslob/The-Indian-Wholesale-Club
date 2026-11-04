-- store_policy's delivery days (D-187): food and the rest, from Settings, for every line that promises them.
begin;
select tests.setup();
update public.pricing_settings set delivery_days_min = 12, delivery_days_max = 16, food_delivery_days_min = 7,
                                   food_delivery_days_max = 7 where id = 1;
set local role anon;
select tests.assert(
  (select (p ->> 'delivery_days_min')::int = 12 and (p ->> 'delivery_days_max')::int = 16
          and (p ->> 'food_delivery_days_min')::int = 7 and (p ->> 'food_delivery_days_max')::int = 7
          and (p ->> 'free_shipping_min_cents')::int = 4999 and (p ->> 'bulk_saving_from_cents')::int = 9999
   from public.store_policy() p),
  'anyone reads the days and the two lines the pages state');
-- TODO(D-187): drop when app <next version> is the minimum
select tests.assert(
  (select (p ->> 'quick_delivery_on')::boolean = false and p -> 'quick_delivery_days_min' = 'null'::jsonb
          and p -> 'quick_delivery_days_max' = 'null'::jsonb and p -> 'quick_delivery_min_cents' = 'null'::jsonb
          and p -> 'express_days_min' = 'null'::jsonb and p -> 'express_days_max' = 'null'::jsonb
   from public.store_policy() p),
  'the old app hides its 7-day store and its schema still parses');
reset role;
rollback;

-- Pricing estimates (migration 19, D-047): loading fills only empty settings and labels them; saving your own number
-- removes the label; admin only.
begin;
select tests.setup();
update public.pricing_settings set fx_inr_per_usd = null, freight_cents_per_kg = null, duty_pct = null,
                                   margin_pct = 77, stale_listing_days = null where id = 1;
delete from public.pricing_estimates;

select tests.assert(
  public._load_pricing_estimates(jsonb_build_array(
    jsonb_build_object('setting', 'fx_inr_per_usd', 'value', 96.48, 'source', 'test rate', 'url', 'https://example.test'),
    jsonb_build_object('setting', 'margin_pct', 'value', 100, 'source', 'test margin', 'url', null),
    jsonb_build_object('setting', 'freight_cents_per_kg', 'value', 600, 'source', 'test freight', 'url', null)),
    date '2026-10-06') = 2,
  'two empty settings filled');
select tests.assert(
  (select fx_inr_per_usd = 96.48 and freight_cents_per_kg = 600 and margin_pct = 77 from public.pricing_settings),
  'D-047: estimates fill empty settings and never overwrite the founder''s own number');
select tests.assert(
  (select array_agg(setting order by setting) from public.pricing_estimates) = array['freight_cents_per_kg', 'fx_inr_per_usd'],
  'each filled value is labelled as an estimate, the founder''s margin is not');
select tests.assert_fails(
  $q$select public._load_pricing_estimates('[{"setting": "shipping_flat_cents", "value": 0, "source": "x"}]', current_date)$q$,
  'unknown_setting', 'only the researched pricing settings can be estimates');

-- The founder saves their own exchange rate: its label goes; the freight estimate stays.
update public.pricing_settings set fx_inr_per_usd = 95 where id = 1;
select tests.assert(
  (select array_agg(setting) from public.pricing_estimates) = array['freight_cents_per_kg'],
  'saving your own number removes its estimate label');
-- Saving the form with the same freight value keeps it labelled (unchanged = still the estimate).
update public.pricing_settings set freight_cents_per_kg = 600, updated_at = now() where id = 1;
select tests.assert(exists (select 1 from public.pricing_estimates where setting = 'freight_cents_per_kg'),
  'an unchanged estimate stays labelled');

set local role authenticated;
select tests.act_as(tests.id('cust_a'));
select tests.assert((select count(*) from public.pricing_estimates) = 0, 'customers cannot see estimates');
select tests.act_as(tests.id('admin'));
select tests.assert((select count(*) from public.pricing_estimates) = 1, 'admins can');
select tests.assert_fails($q$select public._load_pricing_estimates('[]', current_date)$q$, '42501',
  'only the dev seed loads estimates');
reset role;

rollback;

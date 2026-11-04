-- =============================================================================
-- D-187, the simple store, part 3 of 3: what went. The per-minute cycle timer and the exchange-rate timer stop; every
-- vendor, cycle, payout, house-model, photo-job, 7-day and Express function and table goes; pricing_settings keeps
-- only what still decides a price, a charge, a day or a refund. A daily timer starts keeping the logs small (§9 R-7).
-- Kept on purpose (simple-store-plan §2): pickups, shop bills, product_sources, sourcing_shops.quick_delivery,
-- _quick_sourceable, ops_quick_sources, order_shipments, the worker role and is_worker(), the vendor-docs bucket.
-- No CASCADE: each dependency is named and dropped before what it depends on, so a surprise stops here, not silently.
-- Cost (D-147): database size and API schema cache go down, 2 pg_cron jobs less and 1 daily job more (about 1,580
-- fewer database calls a day). No page-cache or egress change.
-- =============================================================================

-- ---------------------------------------------------------------- timers (pg_cron may be absent on a plain Postgres)

do $$
declare
  v_job text;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;
  foreach v_job in array array['iwc-roll-cycles', 'iwc-fx-refresh'] loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- the shop, once more, for anything added since part 1

alter table public.products disable trigger products_set_updated_at;
update public.products p
   set source_site = coalesce(v.online_site, v.shop_name)
  from public.vendors v
 where v.id = p.vendor_id and p.source_site is null;
alter table public.products enable trigger products_set_updated_at;

-- ---------------------------------------------------------------- the vendor role

-- A role value cannot be dropped from the enum. A surprise row must not stop the release: it becomes a plain customer.
do $$
declare
  v_moved integer;
begin
  update public.profiles set role = 'customer' where role = 'vendor';
  get diagnostics v_moved = row_count;
  if v_moved > 0 then
    raise notice 'simple store: % vendor profile(s) moved to the customer role', v_moved;
  end if;
end $$;
alter table public.profiles add constraint profiles_no_vendor_role check (role <> 'vendor');

-- ---------------------------------------------------------------- storage: the two buckets

drop policy if exists "iwc vendor uploads read" on storage.objects;
drop policy if exists "iwc vendor uploads insert" on storage.objects;
drop policy if exists "iwc vendor uploads update" on storage.objects;
drop policy if exists "iwc vendor uploads delete" on storage.objects;
drop policy if exists "iwc candidates read" on storage.objects;
drop policy if exists "iwc candidates insert" on storage.objects;
drop policy if exists "iwc candidates update" on storage.objects;
drop policy if exists "iwc candidates delete" on storage.objects;

-- Hosted Supabase may refuse direct deletes from storage tables; the release must not stop for two old buckets. Then
-- they stay, unreachable (no policy left), and the founder removes them from the dashboard (Storage).
do $$
begin
  begin
    delete from storage.objects where bucket_id in ('vendor-uploads', 'photo-candidates');
    delete from storage.buckets where id in ('vendor-uploads', 'photo-candidates');
  exception when others then
    raise notice 'simple store: buckets vendor-uploads and photo-candidates left in place (%); remove them in the dashboard', sqlerrm;
  end;
end $$;

-- ---------------------------------------------------------------- triggers on tables that stay

drop trigger orders_moves_on_shipped on public.orders;
drop trigger order_items_express_has_no_us_stock on public.order_items;
drop trigger products_food_cleared on public.products;  -- §9 R-9: food simply follows its status
drop trigger pricing_settings_estimate_replaced on public.pricing_settings;

-- ---------------------------------------------------------------- functions

drop function if exists public.vendor_add_photo(uuid, public.photo_view, text, jsonb);
drop function if exists public.vendor_delete_submission(uuid);
drop function if exists public.vendor_keep_ready();
drop function if exists public.vendor_may_upload(text);
drop function if exists public.vendor_me();
drop function if exists public.vendor_money();
drop function if exists public.vendor_new_submission(public.product_type);
drop function if exists public.vendor_pieces(integer, integer);
drop function if exists public.vendor_submission(uuid);
drop function if exists public.vendor_submit(uuid, jsonb);
drop function if exists public._vendor_or_raise();
drop function if exists public._link_vendor_account(uuid, uuid, text, uuid);
drop function if exists public._redeem_vendor_code(text);
drop function if exists public._online_vendor(text, text, uuid);
drop function if exists public.is_vendor();
drop function if exists public.my_vendor_id();
drop function if exists public.admin_vendor_sign_in_code(uuid, integer);
drop function if exists public.admin_approve_submission(uuid, jsonb, jsonb);
drop function if exists public.admin_decline_submission(uuid, text);
drop function if exists public.admin_request_retake(uuid, text, text);
drop function if exists public.admin_rerun_photo_job(uuid, uuid);
drop function if exists public.worker_claim_job();
drop function if exists public.worker_finish_job(uuid, text[], text);
drop function if exists public.record_payout(uuid, uuid[], text, text, text, text);

drop function if exists public.roll_cycles();
drop function if exists public.cutoff_cycle(uuid);
drop function if exists public._cutoff_cycle(uuid);
drop function if exists public.advance_cycle(uuid);
drop function if exists public.move_order(uuid, uuid, text);
drop function if exists public.confirm_move_shipped(uuid);
drop function if exists public.accept_fast_offer(uuid, text);
drop function if exists public.check_off_arrival(uuid, boolean);
drop function if exists public.admin_cycle_totals(uuid);
drop function if exists public._store_cycle();
drop function if exists public._next_cycle_dates(public.cycles);
drop function if exists public._open_next_cycle(uuid);
drop function if exists public._window_from(public.orders, public.cycles);
drop function if exists public._set_window(uuid, date, date, text, text);
drop function if exists public._order_offer(uuid);
drop function if exists public._moves_on_shipped();

drop function if exists public.store_quick_front();
drop function if exists public.store_quick_browse(text, integer, integer);
drop function if exists public.store_quick_bag(uuid[]);
drop function if exists public._quick_days(uuid);
drop function if exists public._quick_listings();
drop function if exists public._quick_listings_of(text);
drop function if exists public._quick_bought(uuid);
drop function if exists public.admin_quick_insights(timestamptz);
drop function if exists public.admin_quick_watch();
drop function if exists public._courier_paise(numeric);
drop function if exists public._express_has_no_us_stock();

drop function if exists public._food_cleared_check();
drop function if exists public._fx_refresh();
drop function if exists public._load_pricing_estimates(jsonb, date);
drop function if exists public._pricing_estimate_replaced();
drop function if exists public._auto_price_cents(integer, integer);
drop function if exists public._tapered_margin(numeric, numeric, numeric, integer, integer);
drop function if exists public._band_price(numeric, numeric, numeric);
drop function if exists public._price_ending(numeric);

-- ---------------------------------------------------------------- columns

alter table public.products drop column vendor_id;
alter table public.pickups
  drop column vendor_id,
  drop column cycle_id,
  drop column payout_id;
alter table public.orders drop column cycle_id;

alter table public.pricing_settings
  -- the cycles and the faster-delivery offer
  drop column cycle_days,
  drop column fast_offer_cents,
  -- the 7-day store's line and pause; its days moved to food_delivery_days_*
  drop column quick_delivery_days_min,
  drop column quick_delivery_days_max,
  drop column quick_delivery_min_cents,
  drop column quick_delivery_paused,
  -- Express (§10 Y-1)
  drop column express_shipping_cents,
  drop column express_days_min,
  drop column express_days_max,
  drop column express_base_cents,
  drop column express_courier_cents_per_kg,
  drop column express_min_kg,
  -- the paused full price formula and the exchange rate (§10 Y-2); beta pricing is fixed in code (D-128)
  drop column beta_pricing,
  drop column fx_inr_per_usd,
  drop column fx_buffer_pct,
  drop column fx_auto,
  drop column fx_updated_at,
  drop column fx_source,
  drop column freight_cents_per_kg,
  drop column duty_pct,
  drop column margin_pct,
  drop column india_handling_paise,
  drop column volumetric_pct,
  drop column broker_cents_per_shipment,
  drop column shipment_kg,
  drop column us_handling_cents,
  drop column us_last_mile_cents_per_kg,
  drop column us_last_mile_min_cents,
  drop column returns_allowance_pct,
  drop column card_fee_pct,
  drop column card_fee_fixed_cents,
  drop column india_handling_pct,
  drop column ship_alloc_paise_per_kg,
  drop column margin_clothing_pct,
  drop column margin_food_pct,
  drop column margin_home_pct,
  drop column shop_divisor,
  drop column ship_paise_per_100g,
  drop column margin_clothing_min_pct,
  drop column margin_home_min_pct,
  drop column taper_clothing_from_cents,
  drop column taper_clothing_to_cents,
  drop column taper_home_from_cents,
  drop column taper_home_to_cents,
  drop column food_fee_paise,
  drop column food_parcel_kg,
  drop column courier_first_kg_paise,
  drop column courier_next_kg_paise,
  drop column parcel_fixed_paise,
  drop column duty_clothing_pct,
  drop column duty_food_pct,
  drop column duty_home_pct,
  drop column min_profit_clothing_cents,
  drop column min_profit_food_cents,
  drop column min_profit_home_cents,
  drop column min_profit_pct,
  drop column min_profit_food_pct,
  drop column guard_card_fee_pct,
  drop column small_food_max_shop_paise,
  drop column small_food_max_g,
  drop column small_food_ship_share_pct,
  drop column small_food_floor_cents,
  drop column small_food_ceiling_cents,
  drop column food_ship_share_pct,
  drop column food_off_step_cents,
  drop column food_off_step_pct,
  drop column food_off_max_pct,
  drop column food_margin_max_pct,
  drop column shown_shipping_cents_per_kg,
  -- §9 R-9: on since D-107, and it could only hide all food
  drop column food_cleared;

-- ---------------------------------------------------------------- tables, children first

drop table public.vendor_payouts;
drop table public.photo_jobs;
drop table public.vendor_submission_photos;
drop table public.vendor_submissions;
drop table public.vendor_applications;
drop table public.vendor_sign_in_codes;
drop table public.vendor_accounts;
drop table public.house_models;
drop table public.order_moves;
drop table public.cycles;
drop table public.vendors;
drop table public.pricing_estimates;
drop table public.fx_fetches;
drop table public.newsletter_subscribers;  -- §9 R-8: no code reads it

drop type public.vendor_status;
drop type public.cycle_status;
drop type public.move_offer_status;
drop type public.photo_job_status;
drop type public.photo_view;
drop type public.submission_status;
drop type public.application_status;

-- ---------------------------------------------------------------- no live connection on a product page (§10 Y-3)

-- The old app's subscription then simply hears nothing. The table stays: search reads it for "sold out last".
do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'variant_availability') then
    alter publication supabase_realtime drop table public.variant_availability;
  end if;
end $$;

-- ---------------------------------------------------------------- the daily tidy (§9 R-7, §10 Y-13)

-- The free database's memory is over its budget and these only ever grow. Batches of 2,000 (D-146), at most 40,000
-- rows of each a day, so the first runs catch up over days instead of holding the database.
create function public._tidy() returns jsonb
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_batch constant integer := 2000;
  v_rounds constant integer := 20;
  v_n integer;
  v_webhooks integer := 0;
  v_emails integer := 0;
  v_errors integer := 0;
  v_searches integer := 0;
  v_runs integer := 0;
begin
  for i in 1 .. v_rounds loop
    delete from public.webhook_events where id in (
      select id from public.webhook_events
      where status = 'done' and processed_at < now() - interval '30 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_webhooks := v_webhooks + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.email_outbox where id in (
      select id from public.email_outbox
      where status = 'sent' and sent_at < now() - interval '30 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_emails := v_emails + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.admin_error_events where id in (
      select id from public.admin_error_events where created_at < now() - interval '90 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_errors := v_errors + v_n;
    exit when v_n < v_batch;
  end loop;
  for i in 1 .. v_rounds loop
    delete from public.search_queries where id in (
      select id from public.search_queries where created_at < now() - interval '90 days' limit v_batch);
    get diagnostics v_n = row_count;
    v_searches := v_searches + v_n;
    exit when v_n < v_batch;
  end loop;
  -- pg_cron's own log; a refusal here (permissions on a hosted database) must not undo the rest
  if to_regclass('cron.job_run_details') is not null then
    begin
      for i in 1 .. v_rounds loop
        execute format(
          'delete from cron.job_run_details where runid in (select runid from cron.job_run_details where end_time < now() - interval %L limit %s)',
          '7 days', v_batch);
        get diagnostics v_n = row_count;
        v_runs := v_runs + v_n;
        exit when v_n < v_batch;
      end loop;
    exception when insufficient_privilege then
      v_runs := -1;
    end;
  end if;
  return jsonb_build_object('webhook_events', v_webhooks, 'email_outbox', v_emails, 'admin_error_events', v_errors,
                            'search_queries', v_searches, 'job_run_details', v_runs);
end $$;
revoke all on function public._tidy() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('iwc-tidy', '37 8 * * *', 'select public._tidy()');  -- a quiet US hour (04:37 Eastern)
  end if;
end $$;

notify pgrst, 'reload schema';

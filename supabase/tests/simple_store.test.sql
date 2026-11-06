-- D-187, the simple store: the delivery day, the case table of simple-store-plan §5 A, the stock answer at checkout,
-- Home's new rows, the daily tidy, and a scan that nothing left in the database still points at what was dropped
-- (PL/pgSQL bodies only fail when they run).
begin;

-- ---------------------------------------------------------------- the delivery day (the same 20 cases as tests/homesick.test.ts in packages/shared)
select tests.assert(public._add_business_days(c.d, c.n) = c.want,
                    format('%s + %s business days is %s, got %s', c.d, c.n, c.want, public._add_business_days(c.d, c.n)))
  from (values
    (date '2026-11-02', 1, date '2026-11-03'),   -- Mon
    (date '2026-11-02', 4, date '2026-11-06'),
    (date '2026-11-02', 5, date '2026-11-09'),
    (date '2026-11-02', 7, date '2026-11-11'),
    (date '2026-11-03', 3, date '2026-11-06'),   -- Tue
    (date '2026-11-03', 4, date '2026-11-09'),
    (date '2026-11-04', 7, date '2026-11-13'),   -- Wed
    (date '2026-11-04', 12, date '2026-11-20'),
    (date '2026-11-04', 16, date '2026-11-26'),
    (date '2026-11-05', 1, date '2026-11-06'),   -- Thu
    (date '2026-11-05', 2, date '2026-11-09'),
    (date '2026-11-06', 1, date '2026-11-09'),   -- Fri
    (date '2026-11-06', 5, date '2026-11-13'),
    (date '2026-11-06', 7, date '2026-11-17'),   -- the Tuesday after next
    (date '2026-11-06', 12, date '2026-11-24'),
    (date '2026-11-06', 16, date '2026-11-30'),
    (date '2026-11-07', 1, date '2026-11-09'),   -- Sat + 1 = Mon
    (date '2026-11-07', 7, date '2026-11-17'),
    (date '2026-11-08', 1, date '2026-11-09'),   -- Sun + 1 = Mon
    (date '2026-11-08', 5, date '2026-11-13')) c(d, n, want);
select tests.assert(public._add_business_days(date '2026-11-07', 0) = date '2026-11-07', 'no days: the day itself');

select tests.setup();

-- ---------------------------------------------------------------- settings (as the migration leaves them)
update public.pricing_settings
   set food_delivery_days_min = 7, food_delivery_days_max = 7, delivery_days_min = 12, delivery_days_max = 16,
       free_shipping_min_cents = 4999, bulk_saving_from_cents = 9999, shipping_cents_per_kg = 1862, food_billed_pct = 100
 where id = 1;

insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, published_at, wears, attributes)
values ('ss-snack', 'Snack', 'food', null, tests.id('cat_food'), 500, 'live', now(), null, '{}'),
       ('ss-kurta', 'Kurta', 'clothing', tests.id('region'), tests.id('cat_clothing'), 1000, 'live', now(), 'women',
        '{"fibre_content": "100% cotton", "care": "Hand wash"}');
update public.products set price_auto = false where slug in ('ss-snack', 'ss-kurta');
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'SS-SNACK', '100 g', 500, 100 from public.products where slug = 'ss-snack'
union all
select id, 'SS-KURTA', 'M', 100, 500 from public.products where slug = 'ss-kurta';
select tests.remember('v_snack', (select id from public.product_variants where sku = 'SS-SNACK'));
select tests.remember('v_kurta', (select id from public.product_variants where sku = 'SS-KURTA'));

create function pg_temp.items(p_snacks integer, p_kurtas integer, p_with_price boolean default false) returns jsonb language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('variant_id', tests.id('v_snack'), 'quantity', p_snacks)
           || case when p_with_price then '{"unit_price_cents": 500}'::jsonb else '{}'::jsonb end as x where p_snacks > 0
    union all
    select jsonb_build_object('variant_id', tests.id('v_kurta'), 'quantity', p_kurtas)
           || case when p_with_price then '{"unit_price_cents": 1000}'::jsonb else '{}'::jsonb end where p_kurtas > 0) y
$$;
create function pg_temp.place(p_name text, p_snacks integer, p_kurtas integer, p_state text, p_shipping integer) returns uuid language sql as $$
  select tests.remember(p_name, (select order_id from public.create_order(jsonb_build_object(
    'email', p_name || '@example.test', 'shipping_address', jsonb_build_object('line1', '1 Main St', 'state', p_state),
    'items', pg_temp.items(p_snacks, p_kurtas, true),
    'subtotal_cents', p_snacks * 500 + p_kurtas * 1000, 'shipping_cents', p_shipping,
    'total_cents', p_snacks * 500 + p_kurtas * 1000 + p_shipping, 'payment_intent_id', 'pi_ss_' || p_name))))
$$;
create function pg_temp.shipments(p_name text) returns text[] language sql as $$
  select array_agg(kind || ':' || est_delivery_from || ':' || est_delivery_to || ':' || shipping_cents order by seq)
    from public.order_shipments where order_id = tests.id(p_name)
$$;
create function pg_temp.w(p_days integer) returns date language sql as $$ select public._add_business_days(current_date, p_days) $$;

-- ---------------------------------------------------------------- the case table (§5 A)

-- food $30: 7 delivery days, Shipping charged (the free line is $49.99 and it is under)
select tests.assert(
  (select (c ->> 'free_min_cents')::int = 4999 and (c ->> 'shipping_cents')::int = 2793
          and c -> 'shipments' @> '{"food_only": true, "split": false, "food_cents": 3000}'::jsonb
   from public.store_bag_charges(pg_temp.items(6, 0)) c),
  'food $30: one food shipment; six 100 g pieces are 1.5 kg (D-190), $27.93, and $30 is under the line');
select pg_temp.place('food30', 6, 0, 'NY', 1862);
select tests.assert(pg_temp.shipments('food30') = array['food:' || pg_temp.w(7) || ':' || pg_temp.w(7) || ':1862'],
  'food $30: the order is one food shipment in 7 delivery days, Shipping on it');
select tests.assert((select est_delivery_from = pg_temp.w(7) and est_delivery_to = pg_temp.w(7) from public.orders where id = tests.id('food30')),
  'food $30: the order''s window is the 7 delivery days');

-- food $50: free (the same line for every bag)
select tests.assert(
  (select (c -> 'shipments' ->> 'food_cents')::int >= (c ->> 'free_min_cents')::int
   from public.store_bag_charges(pg_temp.items(10, 0)) c),
  'food $50 is over the line');
select pg_temp.place('food50', 10, 0, 'NY', 0);
select tests.assert(pg_temp.shipments('food50') = array['food:' || pg_temp.w(7) || ':' || pg_temp.w(7) || ':0'],
  'food $50: free, 7 delivery days');

-- clothing $40 + food $15: free, two shipments
select tests.assert(public.store_bag_charges(pg_temp.items(3, 4)) -> 'shipments' @> '{"split": true, "food_only": false, "food_cents": 1500}'::jsonb,
  'clothing $40 + food $15: two shipments, and $55 is over the line');
select pg_temp.place('mixed55', 3, 4, 'NY', 0);
select tests.assert(pg_temp.shipments('mixed55') = array['food:' || pg_temp.w(7) || ':' || pg_temp.w(7) || ':0',
                                                         'standard:' || pg_temp.w(12) || ':' || pg_temp.w(16) || ':0'],
  'clothing $40 + food $15: shipment 1 food, shipment 2 the rest, both free');

-- clothing $30 + food $10: charged as one parcel, two shipments (D-190: the first kurta is billed 1 kg, the rest their own 1.2 kg: 2.2 kg, $40.96)
select tests.assert((public.store_bag_charges(pg_temp.items(2, 3)) ->> 'shipping_cents')::int = 4096,
  'clothing $30 + food $10: one parcel, 2.2 billed kg');
select pg_temp.place('mixed40', 2, 3, 'NY', 4096);
select tests.assert(
  (select count(*) = 2 and sum(shipping_cents) = 4096 and min(est_delivery_to) = pg_temp.w(7) and max(est_delivery_to) = pg_temp.w(16)
   from public.order_shipments where order_id = tests.id('mixed40')),
  'clothing $30 + food $10: two shipments; their Shipping shares add up to the one parcel');

-- Alaska: one shipment, 12 – 16
select tests.assert(public.store_bag_charges(pg_temp.items(3, 4), 0, 'AK', '1 Main St') -> 'shipments' @> '{"split": false, "food_only": false, "outside": true}'::jsonb,
  'Alaska: one shipment, with the reason');
select pg_temp.place('alaska', 3, 4, 'AK', 0);
select tests.assert(pg_temp.shipments('alaska') = array['standard:' || pg_temp.w(12) || ':' || pg_temp.w(16) || ':0'],
  'Alaska: everything in one shipment, 12 – 16 delivery days, the food too');
select pg_temp.place('alaskafood', 10, 0, 'AK', 0);
select tests.assert(pg_temp.shipments('alaskafood') = array['standard:' || pg_temp.w(12) || ':' || pg_temp.w(16) || ':0'],
  'food alone to Alaska: 12 – 16 as well');

-- A Friday order: the shared rule (business days)
select tests.assert(public._add_business_days(date '2026-11-06', 7) = date '2026-11-17',
  'a Friday order''s food arrives by the Tuesday after next');

-- $120: free from $49.99, the bulk saving's numbers from $99.99 (the arithmetic is tests/domain.test.ts)
select tests.assert(
  public.store_bag_charges(pg_temp.items(0, 12)) @> '{"free_min_cents": 4999, "bulk_saving_from_cents": 9999, "bulk_saving_pct": 10, "bulk_saving_cap_cents": 2500}'::jsonb,
  'a $120 bag: free shipping from $49.99, the bulk saving from $99.99');

-- An order placed before this release keeps its dates: the migration only renames the shipment's kind
update public.order_shipments set est_delivery_from = date '2026-11-20', est_delivery_to = date '2026-11-20'
 where order_id = tests.id('food50');
select tests.assert(
  (select sh -> 'est_delivery_to' = '"2026-11-20"'::jsonb
   from jsonb_array_elements(public.guest_order_lookup((select order_number from public.orders where id = tests.id('food50')), 'food50@example.test') -> 'shipments') sh),
  'an old shipment answers with the dates it was promised');
-- TODO(D-187): drop when app <next version> is the minimum
select tests.assert(
  (select sh ->> 'kind' = 'quick'
   from jsonb_array_elements(public.guest_order_lookup((select order_number from public.orders where id = tests.id('food50')), 'food50@example.test') -> 'shipments') sh),
  'the old app''s schema reads a food shipment as its old kind');
select tests.assert(public.guest_order_lookup((select order_number from public.orders where id = tests.id('food50')), 'food50@example.test') -> 'offer' is null,
  'no faster-delivery offer any more');

-- TODO(D-187): drop after the release. What the old website sends between the migrations and its deploy still works.
select tests.assert(
  (select (c -> 'express') = 'null'::jsonb and (v ->> 'courier_cents')::int = 0
   from public.checkout_context(array[tests.id('v_snack')]) c, jsonb_array_elements(c -> 'variants') v),
  'the old website''s checkout schema still parses');

-- ---------------------------------------------------------------- the stock answer at checkout (§10 Y-3)
update public.product_variants set qty_listed = qty_reserved + 2 where id = tests.id('v_kurta');
update public.product_variants set qty_listed = qty_reserved where id = tests.id('v_snack');
update public.products set status = 'draft' where id = tests.id('p_draft');
create temp table stock on commit drop as
  select s from jsonb_array_elements(public.checkout_context(array[
    tests.id('v_kurta'), tests.id('v_snack'), tests.id('v_placeholder'), '00000000-0000-4000-8000-00000000dead'::uuid]) -> 'stock') s;
select tests.assert((select count(*) = 4 from stock), 'every line asked about is answered, also one no longer on sale');
select tests.assert((select s ->> 'on_sale' = 'true' and (s ->> 'available')::int = 2 and s ->> 'product_name' = 'Kurta' and s ->> 'label' = 'M'
                     from stock where s ->> 'variant_id' = tests.id('v_kurta')::text), 'fewer left: on sale, how many');
select tests.assert((select s ->> 'on_sale' = 'true' and (s ->> 'available')::int = 0
                     from stock where s ->> 'variant_id' = tests.id('v_snack')::text), 'sold out: on sale, none left');
select tests.assert((select s ->> 'on_sale' = 'false' and (s ->> 'available')::int = 0 and s ->> 'product_name' is not null
                     from stock where s ->> 'variant_id' = tests.id('v_placeholder')::text), 'not on sale, with its words for the Remove line');
select tests.assert((select s ->> 'on_sale' = 'false' and s ->> 'product_name' is null
                     from stock where s ->> 'variant_id' = '00000000-0000-4000-8000-00000000dead'), 'an option that is gone');
select tests.assert(not exists (select 1 from stock, tests.json_keys(stock.s) k where k = any (tests.forbidden_keys())),
  'and nothing a customer may not see');
update public.product_variants set qty_listed = qty_reserved + 100 where id in (tests.id('v_kurta'), tests.id('v_snack'));

-- ---------------------------------------------------------------- Home (§5 B) in its one read
insert into public.categories (product_type, slug, name) values ('food', 'sweets', 'Sweets') on conflict (slug) do nothing;
insert into public.products (slug, name, product_type, region_id, category_id, price_cents, status, published_at)
values ('ss-ladoo', 'Ladoo', 'food', null, (select id from public.categories where slug = 'sweets'), 300, 'live', now());
update public.products set price_auto = false where slug = 'ss-ladoo';
insert into public.product_variants (product_id, sku, label, qty_listed, weight_g)
select id, 'SS-LADOO', '100 g', 10, 100 from public.products where slug = 'ss-ladoo';
update public.products set price_cents = 300 where slug = 'ss-ladoo';
insert into public.product_media (product_id, storage_path, is_primary)
select id, 'products/ss/ladoo.jpg', true from public.products where slug = 'ss-ladoo';
set local role anon;
create temp table home on commit drop as select public.store_home() as h;
reset role;
select tests.assert((select h -> 'categories' @> '[{"slug": "sweets", "product_type": "food", "image_path": "products/ss/ladoo.jpg"}]'::jsonb from home),
  'a tile: its category, type, count and newest photo');
select tests.assert((select not exists (select 1 from jsonb_array_elements(h -> 'categories') c where c ->> 'slug' = 'test-clothing') from home),
  'only the tiles'' categories');
select tests.assert((select exists (select 1 from jsonb_array_elements(h -> 'most_ordered') c where c ->> 'slug' = 'ss-kurta') from home),
  'What everyone missed this week: pieces ordered this week');
select tests.assert((select not exists (select 1 from jsonb_array_elements(h -> 'most_ordered') c where c ? 'n' or c ? 'count') from home),
  'the ranking only, never the count (D-003)');
select tests.assert((select bool_and((c ->> 'price_cents')::int < 500) and bool_or(c ->> 'slug' = 'ss-ladoo')
                     from home, jsonb_array_elements(h -> 'under_5') c), 'The kirana counter: under $5');
select tests.assert((select h -> 'just_listed_types' ? 'clothing' and h -> 'just_listed_types' ? 'home'
                            and not h -> 'just_listed_types' ? 'food' from home), 'Just listed is Clothing and Home & gifts');
select tests.assert(not exists (select 1 from home, tests.json_keys(home.h) k where k in ('quick_days', 'coming_soon', 'vendor_id')),
  'no 7-day or coming-soon field on a card');
select tests.assert(not exists (select 1 from home, tests.json_keys(home.h) k where k = any (tests.forbidden_keys())),
  'and nothing a customer may not see');

-- ---------------------------------------------------------------- what stays (false friends, §2)
select tests.assert(to_regprocedure('public.is_worker()') is not null, 'the worker role''s check stays (R-12)');
select tests.assert(to_regprocedure('public._quick_sourceable(uuid)') is not null and to_regprocedure('public.ops_quick_sources(boolean, integer)') is not null,
  'food''s fast shops stay');
select tests.assert(exists (select 1 from storage.buckets where id = 'vendor-docs'), 'the shop bills'' bucket stays');
select tests.assert(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'variant_availability'),
  'no live stock on a product page (Y-3)');
select tests.assert_fails('insert into public.profiles (id, role) values (gen_random_uuid(), ''vendor'')', 'profiles_no_vendor_role',
  'no profile can have the vendor role');
select tests.assert(not exists (select 1 from pg_policies where schemaname = 'storage' and (policyname ilike '%vendor uploads%' or policyname ilike '%candidates%')),
  'the two old buckets have no policy left');

-- ---------------------------------------------------------------- the daily tidy (R-7, Y-13)
insert into public.webhook_events (event_id, event_type, status, processed_at) values
  ('evt_old_done', 'x', 'done', now() - interval '31 days'), ('evt_new_done', 'x', 'done', now() - interval '1 day'),
  ('evt_old_open', 'x', 'processing', now() - interval '31 days');
insert into public.email_outbox (kind, recipient, payload, status, sent_at) values
  ('order_confirmation', 'old@example.test', '{}', 'sent', now() - interval '31 days'),
  ('order_confirmation', 'new@example.test', '{}', 'sent', now() - interval '1 day'),
  ('order_confirmation', 'dead@example.test', '{}', 'dead_letter', null);
insert into public.admin_error_events (event, context, created_at) values
  ('old', '{}', now() - interval '91 days'), ('new', '{}', now() - interval '1 day');
insert into public.search_queries (query, results, created_at) values
  ('old', 1, now() - interval '91 days'), ('new', 1, now() - interval '1 day');
select public._tidy();
select tests.assert((select count(*) = 2 from public.webhook_events where event_id in ('evt_new_done', 'evt_old_open')), 'a recent or unfinished webhook stays');
select tests.assert(not exists (select 1 from public.webhook_events where event_id = 'evt_old_done'), 'a done webhook older than 30 days goes');
select tests.assert(not exists (select 1 from public.email_outbox where recipient = 'old@example.test')
                    and exists (select 1 from public.email_outbox where recipient = 'new@example.test')
                    and exists (select 1 from public.email_outbox where recipient = 'dead@example.test'), 'sent emails older than 30 days go, nothing else');
select tests.assert(not exists (select 1 from public.admin_error_events where event = 'old')
                    and exists (select 1 from public.admin_error_events where event = 'new'), 'error events older than 90 days go');
select tests.assert(not exists (select 1 from public.search_queries where query = 'old')
                    and exists (select 1 from public.search_queries where query = 'new'), 'searches older than 90 days go (Y-13)');
select tests.assert(not has_function_privilege('anon', 'public._tidy()', 'execute')
                    and not has_function_privilege('authenticated', 'public._tidy()', 'execute'), 'only the timer runs it');

-- ---------------------------------------------------------------- nothing points at what was dropped

create temp table gone (name text) on commit drop;
insert into gone values
  -- tables, types
  ('vendors'), ('vendor_accounts'), ('vendor_sign_in_codes'), ('vendor_applications'), ('vendor_submissions'),
  ('vendor_submission_photos'), ('vendor_payouts'), ('photo_jobs'), ('house_models'), ('order_moves'), ('cycles'),
  ('pricing_estimates'), ('fx_fetches'), ('newsletter_subscribers'), ('vendor_status'), ('cycle_status'),
  ('move_offer_status'), ('photo_job_status'), ('photo_view'), ('submission_status'), ('application_status'),
  -- columns
  ('vendor_id'), ('cycle_id'), ('payout_id'), ('soon'),
  -- settings
  ('cycle_days'), ('fast_offer_cents'), ('quick_delivery_days_min'), ('quick_delivery_days_max'),
  ('quick_delivery_min_cents'), ('quick_delivery_paused'), ('pilot_delivery_days_min'), ('pilot_delivery_days_max'),
  ('express_shipping_cents'), ('express_days_min'), ('express_days_max'), ('express_base_cents'),
  ('express_courier_cents_per_kg'), ('express_min_kg'), ('beta_pricing'), ('fx_inr_per_usd'), ('fx_buffer_pct'), ('fx_auto'),
  ('fx_updated_at'), ('fx_source'), ('freight_cents_per_kg'), ('duty_pct'), ('margin_pct'), ('india_handling_paise'),
  ('volumetric_pct'), ('broker_cents_per_shipment'), ('shipment_kg'), ('us_handling_cents'), ('us_last_mile_cents_per_kg'),
  ('us_last_mile_min_cents'), ('returns_allowance_pct'), ('card_fee_pct'), ('card_fee_fixed_cents'), ('india_handling_pct'),
  ('ship_alloc_paise_per_kg'), ('margin_clothing_pct'), ('margin_food_pct'), ('margin_home_pct'), ('shop_divisor'),
  ('ship_paise_per_100g'), ('margin_clothing_min_pct'), ('margin_home_min_pct'), ('taper_clothing_from_cents'),
  ('taper_clothing_to_cents'), ('taper_home_from_cents'), ('taper_home_to_cents'), ('food_fee_paise'), ('food_parcel_kg'),
  ('courier_first_kg_paise'), ('courier_next_kg_paise'), ('parcel_fixed_paise'), ('duty_clothing_pct'), ('duty_food_pct'),
  ('duty_home_pct'), ('min_profit_clothing_cents'), ('min_profit_food_cents'), ('min_profit_home_cents'), ('min_profit_pct'),
  ('min_profit_food_pct'), ('guard_card_fee_pct'), ('small_food_max_shop_paise'), ('small_food_max_g'),
  ('small_food_ship_share_pct'), ('small_food_floor_cents'), ('small_food_ceiling_cents'), ('food_ship_share_pct'),
  ('food_off_step_cents'), ('food_off_step_pct'), ('food_off_max_pct'), ('food_margin_max_pct'),
  ('shown_shipping_cents_per_kg'), ('food_cleared'), ('spices_cleared'),
  -- functions
  ('vendor_add_photo'), ('vendor_delete_submission'), ('vendor_keep_ready'), ('vendor_may_upload'), ('vendor_me'),
  ('vendor_money'), ('vendor_new_submission'), ('vendor_pieces'), ('vendor_submission'), ('vendor_submit'),
  ('_vendor_or_raise'), ('_link_vendor_account'), ('_redeem_vendor_code'), ('_online_vendor'), ('is_vendor'), ('my_vendor_id'),
  ('admin_vendor_sign_in_code'), ('admin_approve_submission'), ('admin_decline_submission'), ('admin_request_retake'),
  ('admin_rerun_photo_job'), ('worker_claim_job'), ('worker_finish_job'), ('record_payout'), ('roll_cycles'), ('cutoff_cycle'),
  ('_cutoff_cycle'), ('advance_cycle'), ('move_order'), ('confirm_move_shipped'), ('accept_fast_offer'), ('check_off_arrival'),
  ('admin_cycle_totals'), ('_store_cycle'), ('_next_cycle_dates'), ('_open_next_cycle'), ('_window_from'), ('_set_window'),
  ('_order_offer'), ('_moves_on_shipped'), ('store_quick_front'), ('store_quick_browse'), ('store_quick_bag'), ('_quick_days'),
  ('_quick_listings'), ('_quick_listings_of'), ('_quick_bought'), ('admin_quick_insights'), ('admin_quick_watch'),
  ('_courier_paise'), ('_express_has_no_us_stock'), ('_food_cleared_check'), ('_fx_refresh'), ('_load_pricing_estimates'),
  ('_pricing_estimate_replaced'), ('_tapered_margin'), ('_band_price'), ('_price_ending');

-- Comments and string literals out (a key's name in a JSON answer is not a reader; the old clients' keys are on purpose).
create function pg_temp.code(p_src text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(p_src, '--[^\n]*', '', 'g'), '''[^'']*''', '', 'g')
$$;

create temp table leftover on commit drop as
  select 'function ' || p.proname as what, g.name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    join gone g on pg_temp.code(p.prosrc) ~ ('\m' || g.name || '\M')
   where n.nspname = 'public' and d.objid is null
  union all
  select 'view ' || v.viewname, g.name
    from pg_views v join gone g on v.definition ~ ('\m' || g.name || '\M')
   where v.schemaname = 'public'
  union all
  select 'policy ' || pl.tablename || '.' || pl.policyname, g.name
    from pg_policies pl join gone g on coalesce(pl.qual, '') || coalesce(pl.with_check, '') ~ ('\m' || g.name || '\M')
   where pl.schemaname in ('public', 'storage')
  union all
  select 'trigger ' || t.tgname, g.name
    from pg_trigger t
    join gone g on pg_get_triggerdef(t.oid) ~ ('\m' || g.name || '\M')
   where not t.tgisinternal and t.tgrelid::regclass::text not like 'storage.%';
do $$
begin
  if to_regclass('cron.job') is not null then
    execute $q$insert into leftover select 'cron ' || j.jobname, g.name from cron.job j join gone g on j.command ~ ('\m' || g.name || '\M')$q$;
  end if;
end $$;
select tests.assert(not exists (select 1 from leftover),
  'nothing left points at what was dropped: ' || coalesce((select string_agg(what || ' -> ' || name, ', ') from leftover), ''));

select tests.assert(not exists (select 1 from information_schema.columns where table_schema = 'public'
                                   and column_name in ('vendor_id', 'cycle_id', 'payout_id')), 'no vendor, cycle or payout column anywhere');
select tests.assert(not exists (select 1 from information_schema.tables t join gone g on g.name = t.table_name where t.table_schema = 'public'),
  'no dropped table left');
select tests.assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace join gone g on g.name = p.proname where n.nspname = 'public'),
  'no dropped function left, in any overload');
select tests.assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.proname = '_auto_price_cents' and p.pronargs = 2),
  'the price formula has one signature');
do $$
begin
  if to_regclass('cron.job') is not null then
    execute $q$select tests.assert((select count(*) = 0 from cron.job where jobname in ('iwc-roll-cycles', 'iwc-fx-refresh'))
                                   and (select count(*) = 1 from cron.job where jobname = 'iwc-tidy'), 'the timers: two gone, the tidy in')$q$;
  end if;
end $$;

rollback;

-- =============================================================================
-- D-154 step 3: the bag shows its shipments. store_bag_charges also says which of the asked options are 7-day pieces
-- (`quick_ids`, only ids the browser sent; the tag on their cards already says so) and the dates each shipment would
-- arrive by from today (`dates`: the 7-day days and the normal window, as store_next_delivery and checkout_context
-- give them), so the bag can group its lines under "Shipment 1 · Arrives by Fri, Oct 30" without a second request.
-- Nothing about shops (D-003), and no longer the bag's billed grams or the weight share, which step 1's answer
-- carried to the browser (non-negotiable 1: no weights in API responses).
-- =============================================================================

-- Latest before: 20261023120000_seven_day_shipments (same arguments, two keys added).
create or replace function public.store_bag_charges(p_items jsonb, p_discount_cents integer default 0,
                                                    p_state text default null, p_line1 text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  s public.pricing_settings;
  v_ship jsonb;
  v_from_india boolean;
  v_next record;
begin
  select * into s from public.pricing_settings where id = 1;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid_bag' using errcode = 'P0001';
  end if;
  v_ship := public._bag_shipments(p_items, p_discount_cents, p_state, p_line1);
  v_from_india := (v_ship ->> 'billed_grams')::integer > 0;
  select * into v_next from public.store_next_delivery() limit 1;
  return jsonb_build_object(
    'free_min_cents', s.free_shipping_min_cents,
    'shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'past_line_cents', 0,
    'retailer_cents', case when v_from_india then coalesce(s.small_order_retailer_cents, 0) else 0 end,
    'retailer_pct', case when v_from_india then coalesce(s.retailer_pct, 0) else 0 end,
    'bulk_saving_pct', coalesce(s.bulk_saving_pct, 0),
    'bulk_saving_cap_cents', coalesce(s.bulk_saving_cap_cents, 0),
    'shown_shipping_cents', (v_ship ->> 'shipping_cents')::integer,
    'quick_free', (v_ship ->> 'quick_only')::boolean,
    -- no weights on a customer surface (D-003): the billed kg and the weight share stay in the database
    'shipments', v_ship - 'quick_variant_ids' - 'billed_grams' - 'quick_shipping_cents',
    'quick_ids', coalesce(v_ship -> 'quick_variant_ids', '[]'::jsonb),
    'dates', jsonb_build_object(
      'quick_from', case when v_ship ->> 'days_min' is not null then current_date + (v_ship ->> 'days_min')::integer end,
      'quick_to', case when v_ship ->> 'days_max' is not null then current_date + (v_ship ->> 'days_max')::integer end,
      'standard_from', v_next.est_delivery_from,
      'standard_to', v_next.est_delivery_to));
end $$;

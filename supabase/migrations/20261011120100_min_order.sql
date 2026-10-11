-- =============================================================================
-- The smallest order (D-109): checkout_context() and store_policy() carry `min_order_cents`, so the checkout server
-- refuses a smaller bag and the bag and the Shipping & returns page say so. Both are the latest earlier versions
-- (`20261007200000_us_stock_checkout`, `20261007180000_store_policy`) with that one field added; create or replace keeps their grants.
-- =============================================================================

create or replace function public.checkout_context(p_variant_ids uuid[], p_promo_code text default null, p_state text default null)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'variant_id', v.id, 'product_id', p.id, 'product_name', p.name, 'product_slug', p.slug,
               'product_type', p.product_type, 'region_slug', p.region_slug, 'region_name', p.region_name,
               'label', v.label, 'price_cents', v.price_cents, 'available', v.available,
               'image_path', p.primary_image_path,
               'tax_class', c.tax_class,
               -- What the courier charges to carry one piece (express, D-070): a price, never the weight itself (INV-1).
               'courier_cents', ceil(coalesce(pv.weight_g, c.default_weight_g, 1000) / 1000.0
                                     * coalesce((select s.express_courier_cents_per_kg from public.pricing_settings s
                                                 where s.id = 1), 0))::integer)
             order by p.name, v.sort_order)
      from public.store_variants v
      join public.store_products p on p.id = v.product_id
      join public.product_variants pv on pv.id = v.id
      join public.products pr on pr.id = p.id
      join public.categories c on c.id = pr.category_id
      where v.id = any (p_variant_ids)), '[]'::jsonb),
    'promo', (
      select jsonb_build_object('id', c.id, 'code', c.code, 'discount_type', c.discount_type,
                                'discount_value', c.discount_value, 'min_order_cents', c.min_order_cents)
      from public.promo_codes c
      where nullif(trim(p_promo_code), '') is not null
        and c.code = upper(trim(p_promo_code))
        and c.is_active
        and (c.max_uses is null or c.uses_count < c.max_uses)
        and (c.valid_from is null or c.valid_from <= now())
        and (c.valid_until is null or c.valid_until >= now())),
    'shipping', (
      select jsonb_build_object('flat_cents', s.shipping_flat_cents, 'free_min_cents', s.free_shipping_min_cents,
                                'min_order_cents', s.min_order_cents)
      from public.pricing_settings s where s.id = 1),
    'delivery', (select to_jsonb(d) from public.store_next_delivery() d limit 1),
    'tax', (
      select jsonb_build_object('state', t.state, 'rate_pct', t.rate_pct, 'taxes_clothing', t.taxes_clothing,
                                'taxes_food', t.taxes_food, 'taxes_general', t.taxes_general)
      from public.tax_rates t where t.state = upper(trim(p_state))),
    -- A bag of only pieces already in the US ships from the warehouse at once: today + the US delivery days (D-072).
    'us_delivery', (
      select jsonb_build_object('est_delivery_from', current_date + s.domestic_days_min,
                                'est_delivery_to', current_date + s.domestic_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.domestic_days_min is not null and s.domestic_days_max is not null
        and cardinality(p_variant_ids) > 0
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and not pr.is_us_stock)),
    -- Express is the courier from Mumbai (D-070): never for a bag with a piece already in the US.
    'express', (
      select jsonb_build_object('base_cents', s.express_base_cents,
                                'min_courier_cents', ceil(s.express_min_kg * s.express_courier_cents_per_kg)::integer,
                                'est_delivery_from', current_date + s.express_days_min,
                                'est_delivery_to', current_date + s.express_days_max)
      from public.pricing_settings s
      where s.id = 1 and s.express_base_cents is not null and s.express_courier_cents_per_kg is not null
        and s.express_min_kg is not null and s.express_days_min is not null and s.express_days_max is not null
        and not exists (select 1 from public.product_variants pv join public.products pr on pr.id = pv.product_id
                        where pv.id = any (p_variant_ids) and pr.is_us_stock))
  );
$$;

create or replace function public.store_policy()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'shipping_flat_cents', s.shipping_flat_cents,
    'free_shipping_min_cents', s.free_shipping_min_cents,
    'min_order_cents', s.min_order_cents,
    'express_days_min', s.express_days_min,
    'express_days_max', s.express_days_max,
    'us_delivery_days_min', s.domestic_days_min,
    'us_delivery_days_max', s.domestic_days_max,
    'cancel_fee_pct', s.cancel_fee_pct,
    'return_claim_days', s.return_claim_days,
    'return_tiers', coalesce((
      select jsonb_agg(jsonb_build_object('days', t.days, 'kept_pct', t.pct) order by t.days)
      from (values (s.return_tier1_days, s.return_tier1_pct), (s.return_tier2_days, s.return_tier2_pct),
                   (s.return_tier3_days, s.return_tier3_pct)) t (days, pct)
      where t.days is not null and t.pct is not null), '[]'::jsonb),
    'tax', coalesce((
      select jsonb_agg(jsonb_build_object('state', r.state, 'rate_pct', r.rate_pct, 'clothing', r.taxes_clothing,
                                          'food', r.taxes_food, 'general', r.taxes_general)
                       order by r.state)
      from public.tax_rates r), '[]'::jsonb))
  from public.pricing_settings s
  where s.id = 1;
$$;

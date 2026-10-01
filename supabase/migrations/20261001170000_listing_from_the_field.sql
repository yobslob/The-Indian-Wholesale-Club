-- =============================================================================
-- C3, listing from the field (flows.md §2, D-032):
--  - admin_create_listing(jsonb): a draft product and its variants in one transaction, so a phone that loses its
--    connection halfway never leaves half a listing. The region comes from the shop (flows.md §2 step 1). Every
--    variant's quantity is what the shop has now, so it counts as confirmed (qty_confirmed_at) and is logged as
--    'listed' in the stock ledger by the existing trigger. Photos are added after (Storage, then product_media).
--  - admin_stale_variants(): live variants whose quantity was not re-confirmed with the shop within
--    pricing_settings.stale_listing_days (flows.md §2): the "re-check with the shop" list on Today. Nothing when the
--    founder has not set the number of days (D-047: never defaulted).
-- Both refuse non-admins (INV-7) and run as the caller, so RLS applies too.
-- =============================================================================

create function public.admin_create_listing(p_listing jsonb)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_variant jsonb;
  v_n integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select * into v_vendor from public.vendors
   where id = nullif(p_listing ->> 'vendor_id', '')::uuid and status = 'active';
  if not found then
    raise exception 'vendor_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_listing -> 'variants', '[]'::jsonb)) <> 'array' then
    raise exception 'variants_must_be_a_list' using errcode = 'P0001';
  end if;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, status, created_by)
  values (v_vendor.id, v_vendor.region_id, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          (p_listing ->> 'price_cents')::integer, nullif(p_listing ->> 'shop_price_paise', '')::integer,
          'draft', auth.uid())
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            (v_variant ->> 'qty')::integer, now(), v_n);
  end loop;
  return v_id;
end $$;

create function public.admin_stale_variants()
returns table (variant_id uuid, product_id uuid, product_name text, label text, qty_listed integer,
               qty_confirmed_at timestamptz, shop_name text)
language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  v_days integer := (select s.stale_listing_days from public.pricing_settings s where s.id = 1);
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if v_days is null then
    return;
  end if;
  return query
    select v.id, p.id, p.name, v.label, v.qty_listed, v.qty_confirmed_at, s.shop_name
    from public.product_variants v
    join public.products p on p.id = v.product_id
    join public.vendors s on s.id = p.vendor_id
    where p.status = 'live' and v.is_active
      and (v.qty_confirmed_at is null or v.qty_confirmed_at < now() - v_days * interval '1 day')
    order by v.qty_confirmed_at nulls first, p.name, v.sort_order;
end $$;

revoke all on function public.admin_create_listing(jsonb), public.admin_stale_variants() from public, anon, authenticated;
grant execute on function public.admin_create_listing(jsonb), public.admin_stale_variants() to authenticated, service_role;

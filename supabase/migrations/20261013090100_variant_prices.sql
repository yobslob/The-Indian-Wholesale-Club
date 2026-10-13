-- =============================================================================
-- D-118: a variant with its own shop price (a flavour, a pack size, a colour that costs more) gets its own automatic
-- price from that shop price and its own weight; the product's price (the cards' "from" price) is the lowest of its
-- variants'. Products without variant shop prices are priced exactly as before (D-109, D-111).
-- Latest pricing functions before this: 20261012120000_pilot_charges.
-- =============================================================================

-- The product's automatic price: the cheapest active variant that has its own shop price, else the product's shop
-- price at the heaviest active variant's weight (else the category's typical weight). Null while settings are missing.
create function public._product_auto_price(p_product uuid, p_shop_paise integer, p_category uuid,
                                           p_type public.product_type)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  with w as (
    select coalesce((select max(v.weight_g) from public.product_variants v
                      where v.product_id = p_product and v.is_active),
                    (select c.default_weight_g from public.categories c where c.id = p_category)) as g
  )
  select coalesce(
    (select min(public._auto_price_cents(v.shop_price_paise, coalesce(v.weight_g, w.g), p_type))
       from public.product_variants v
      where v.product_id = p_product and v.is_active and v.shop_price_paise is not null),
    public._auto_price_cents(p_shop_paise, w.g, p_type))
  from w;
$$;

create or replace function public._reprice_products(p_product uuid default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_variants integer;
  v_products integer;
begin
  -- variants with their own shop price (manual prices, price_auto off, are left alone)
  update public.product_variants v
     set price_cents = n.price
    from (select v2.id,
                 public._auto_price_cents(v2.shop_price_paise, coalesce(v2.weight_g, public._pricing_weight_g(x.id)),
                                          x.product_type) as price
            from public.product_variants v2
            join public.products x on x.id = v2.product_id
           where x.price_auto and v2.shop_price_paise is not null and (p_product is null or x.id = p_product)) n
   where v.id = n.id and n.price is not null and v.price_cents is distinct from n.price;
  get diagnostics v_variants = row_count;

  update public.products p
     set price_cents = n.price
    from (select x.id, public._product_auto_price(x.id, x.shop_price_paise, x.category_id, x.product_type) as price
            from public.products x
           where x.price_auto and (p_product is null or x.id = p_product)) n
   where p.id = n.id and n.price is not null and p.price_cents is distinct from n.price;
  get diagnostics v_products = row_count;
  return v_variants + v_products;
end $$;

create or replace function public._reprice_on_product() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.price_auto then
    new.price_cents := coalesce(
      public._product_auto_price(new.id, new.shop_price_paise, new.category_id, new.product_type),
      new.price_cents);
  end if;
  return new;
end $$;

-- A variant's shop price now moves prices too.
drop trigger product_variants_auto_price on public.product_variants;
create trigger product_variants_auto_price
  after insert or update of weight_g, is_active, shop_price_paise or delete on public.product_variants
  for each row execute function public._reprice_on_variant();

-- A listing made by hand can carry a shop price per variant (the importer's flavours and packs). Otherwise unchanged
-- (latest: 20261012120000_pilot_charges).
create or replace function public.admin_create_listing(p_listing jsonb)
returns uuid
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_variant jsonb;
  v_n integer := 0;
  v_price integer := nullif(p_listing ->> 'price_cents', '')::integer;
  v_shop integer := nullif(p_listing ->> 'shop_price_paise', '')::integer;
  v_weight integer;
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
  if v_price is null then
    select coalesce(max(nullif(v ->> 'weight_g', '')::integer),
                    (select default_weight_g from public.categories where id = (p_listing ->> 'category_id')::uuid))
      into v_weight
    from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) v;
    v_price := public.admin_price_preview(v_shop, v_weight, (p_listing ->> 'product_type')::public.product_type);
    if v_price is null then
      raise exception 'price_needed' using errcode = 'P0001';
    end if;
  end if;

  insert into public.products (vendor_id, region_id, category_id, product_type, name, slug, summary, attributes,
                               price_cents, shop_price_paise, price_auto, status, created_by)
  values (v_vendor.id, v_vendor.region_id, (p_listing ->> 'category_id')::uuid,
          (p_listing ->> 'product_type')::public.product_type, p_listing ->> 'name', p_listing ->> 'slug',
          nullif(p_listing ->> 'summary', ''), coalesce(p_listing -> 'attributes', '{}'::jsonb),
          v_price, v_shop, nullif(p_listing ->> 'price_cents', '') is null, 'draft', auth.uid())
  returning id into v_id;

  for v_variant in select * from jsonb_array_elements(coalesce(p_listing -> 'variants', '[]'::jsonb)) loop
    v_n := v_n + 1;
    insert into public.product_variants (product_id, sku, label, options, weight_g, qty_listed, qty_confirmed_at,
                                         sort_order, shop_price_paise)
    values (v_id, upper(p_listing ->> 'slug') || '-' || v_n, v_variant ->> 'label',
            coalesce(v_variant -> 'options', '{}'::jsonb), nullif(v_variant ->> 'weight_g', '')::integer,
            (v_variant ->> 'qty')::integer, now(), v_n, nullif(v_variant ->> 'shop_price_paise', '')::integer);
  end loop;
  return v_id;
end $$;

revoke all on function public._product_auto_price(uuid, integer, uuid, public.product_type)
  from public, anon, authenticated;

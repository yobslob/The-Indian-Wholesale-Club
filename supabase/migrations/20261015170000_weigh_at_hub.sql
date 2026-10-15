-- =============================================================================
-- D-130: the India desk weighs each piece when it reaches the hub (the founder: "Do this task here: Weigh pieces at
-- the hub when they arrive", after D-129). A shop's page or a matching item gives a weight; the scale gives the
-- truth. When a piece is marked picked (in the pilot: when it arrives at the hub, flows.md §1), the desk may weigh one
-- piece packed; admin_weigh_pickup() makes that the option's weight (weighed, D-129), so the database reprices the
-- listing for the next customer (D-128), and keeps on the pickup what changed, for the card to show.
--  - Other sizes and colours of the same piece with no weight, or only a matching item's, take it too (similar);
--    packs never do, and a weighed or typed weight elsewhere is left alone.
--  - A hand-set price does not move; the note says so.
-- =============================================================================

alter table public.pickups
  add column weighed_g integer check (weighed_g between 1 and 50000),
  add column weigh_note text check (char_length(weigh_note) <= 300);

comment on column public.pickups.weigh_note is
  'D-130: what weighing this piece changed: "Weighed 310 g (listed 450 g, -31%): price $25.30, was $17.33"';

create function public._usd(p_cents integer) returns text language sql immutable as $$
  select case when p_cents is null then '—' else '$' || to_char(p_cents / 100.0, 'FM999990.00') end
$$;
revoke all on function public._usd(integer) from public, anon, authenticated;

create function public.admin_weigh_pickup(p_pickup uuid, p_grams integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_pickup public.pickups;
  v_variant public.product_variants;
  v_product public.products;
  v_old_g integer;
  v_old_cents integer;
  v_new_cents integer;
  v_pct integer;
  v_note text;
  v_order text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_grams is null or p_grams not between 1 and 50000 then
    raise exception 'weight_invalid' using errcode = 'P0001';
  end if;
  select * into v_pickup from public.pickups where id = p_pickup for update;
  if not found or v_pickup.status <> 'picked' then
    raise exception 'pickup_not_picked' using errcode = 'P0001';
  end if;
  select * into v_variant from public.product_variants where id = v_pickup.variant_id for update;
  select * into v_product from public.products where id = v_variant.product_id;
  select o.order_number into v_order
    from public.order_items i join public.orders o on o.id = i.order_id where i.id = v_pickup.order_item_id;
  v_old_g := v_variant.weight_g;
  v_old_cents := coalesce(v_variant.price_cents, v_product.price_cents);

  update public.product_variants
     set weight_g = p_grams, weight_source = 'weighed',
         weight_note = left(format('Weighed at the hub, order %s', coalesce(v_order, '?')), 200)
   where id = v_variant.id;

  -- the same piece's other sizes and colours that still guess (none, or a matching item's); never a pack
  if not (v_variant.options ? 'pack') then
    update public.product_variants s
       set weight_g = p_grams, weight_source = 'similar',
           weight_note = left(format('Option %s weighed at the hub', v_variant.label), 200)
     where s.product_id = v_variant.product_id and s.id <> v_variant.id and not (s.options ? 'pack')
       and (s.weight_g is null or s.weight_source = 'similar');
  end if;

  -- the reprice triggers (D-128) have run; read the price the next customer pays
  select coalesce(v.price_cents, p.price_cents) into v_new_cents
    from public.product_variants v join public.products p on p.id = v.product_id where v.id = v_variant.id;
  v_pct := case when v_old_g > 0 then round((p_grams - v_old_g) * 100.0 / v_old_g)::integer end;
  v_note := format('Weighed %s g', p_grams)
            || case when v_old_g is null then ' (it had no weight)'
                    when v_pct = 0 then format(' (listed %s g)', v_old_g)
                    else format(' (listed %s g, %s%s%%)', v_old_g, case when v_pct > 0 then '+' else '' end, v_pct) end
            || case when not v_product.price_auto then ': the price is set by hand, unchanged'
                    when v_new_cents is distinct from v_old_cents
                      then format(': price now %s, was %s', public._usd(v_new_cents), public._usd(v_old_cents))
                    else format(': price %s, unchanged', public._usd(v_new_cents)) end;

  update public.pickups set weighed_g = p_grams, weigh_note = left(v_note, 300) where id = p_pickup;
  return jsonb_build_object('weighed_g', p_grams, 'listed_g', v_old_g, 'change_pct', v_pct,
                            'old_cents', v_old_cents, 'new_cents', v_new_cents, 'note', v_note,
                            'big_change', coalesce(abs(v_pct) > 10, true));
end $$;
revoke all on function public.admin_weigh_pickup(uuid, integer) from public, anon;
grant execute on function public.admin_weigh_pickup(uuid, integer) to authenticated;
